<?php

namespace App\Services\Stripe;

use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Payment;
use App\Models\StripeEvent;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Event;

/**
 * What a verified Stripe event is allowed to do.
 *
 * This is the only thing in the system that can move an order to
 * `payment_status = verified` without a person. It has earned that in a way
 * the AzamPay callback never could: Stripe signs its webhooks, the signature
 * is checked against a secret only we and Stripe hold, and the payload is
 * verified before it reaches this class. A request that fails that check never
 * gets here.
 *
 * Everything else stays where it was:
 *
 *   - stock was reserved at order creation and is not touched again
 *   - vendor wallets are credited when an order completes, not when it is paid
 *   - the order's journey (`orders.status`) is not moved by a payment
 *   - refunds and disputes are recorded and change no order state
 *
 * ---- why the recorded event comes first ----
 *
 * Stripe retries anything that does not answer 2xx, so the same event arrives
 * repeatedly. The `stripe_events` row is written before any work, and its
 * primary key is Stripe's own event id, so a redelivery loses at the database.
 * An `if (already processed)` would leave a window two concurrent deliveries
 * can both pass — and two deliveries of `checkout.session.completed` passing
 * it would write two "payment received" entries onto a buyer's timeline.
 */
class WebhookProcessor
{
    /** Recorded and acted on. */
    public const HANDLED = 'handled';

    /** Seen before. Nothing done, deliberately. */
    public const DUPLICATE = 'duplicate';

    /** A type we do not act on. Recorded so the record is complete. */
    public const IGNORED = 'ignored';

    /**
     * Payment states a webhook may move an order out of.
     *
     * `verified` is absent so that a late or replayed event cannot knock a
     * settled order back into a queue, and `not_required` is absent because a
     * cash-on-delivery order owes nothing — an event claiming otherwise is a
     * mistake or a mismatch, and either way the answer is to record it and
     * change nothing.
     */
    private const MOVEABLE = ['awaiting_payment', 'awaiting_verification', 'rejected'];

    public function handle(Event $event): string
    {
        // Written first, so a redelivery collides here rather than in a check.
        try {
            $record = StripeEvent::create([
                'id'      => $event->id,
                'type'    => $event->type,
                'payload' => Payment::redact($event->data->object->toArray()),
            ]);
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                Log::info('Stripe event ignored as duplicate', ['event_id' => $event->id]);

                return self::DUPLICATE;
            }

            throw $e;
        }

        try {
            $outcome = match ($event->type) {
                'checkout.session.completed',
                'checkout.session.async_payment_succeeded' => $this->settle($event),

                'checkout.session.async_payment_failed'    => $this->fail($event),
                'checkout.session.expired'                 => $this->expire($event),

                // Recorded only. Moving an order because of a refund or a
                // dispute is a decision a person makes, and this release does
                // not make it for them.
                'charge.refunded'                          => $this->recordRefund($event),
                'charge.dispute.created'                   => $this->recordDispute($event),

                default                                    => self::IGNORED,
            };

            $record->markProcessed();

            return $outcome;
        } catch (\Throwable $e) {
            // The failure is recorded against the event and the row is removed,
            // so Stripe's retry can work. A row left behind would block every
            // later delivery of an event we never actually handled.
            Log::error('Stripe webhook processing failed', [
                'event_id' => $event->id,
                'type'     => $event->type,
                'error'    => $e->getMessage(),
            ]);

            $record->markFailed($e->getMessage());
            $record->delete();

            throw $e;
        }
    }

    /* ---------------------------------------------------------------- */

    /**
     * The money arrived. Settle the order.
     *
     * `checkout.session.completed` fires for delayed payment methods while the
     * session is still unpaid, so the session's own `payment_status` is checked
     * rather than the event type. Fulfilling on the event alone would grant
     * goods for payments that later fail, and never fulfil the ones that
     * succeed — the async success event would arrive to find the order already
     * settled and do nothing.
     */
    private function settle(Event $event): string
    {
        $session = $event->data->object;

        if (($session->payment_status ?? null) === 'unpaid') {
            $this->touchPayment($session, Payment::PENDING);

            return self::IGNORED;
        }

        $reference = $this->reference($session);

        if ($reference === null) {
            return self::IGNORED;
        }

        DB::transaction(function () use ($session, $reference) {
            $lines = Order::where('reference', $reference)->lockForUpdate()->get();

            if ($lines->isEmpty()) {
                Log::warning('Stripe settled a session for an unknown order', ['reference' => $reference]);

                return;
            }

            $payment = $this->touchPayment($session, Payment::PAID, [
                'paid_at' => now(),
            ]);

            $first = $lines->first();
            $current = (string) ($first->payment_status ?? 'not_required');

            if (! in_array($current, self::MOVEABLE, true)) {
                // Already settled, or nothing was owed.
                return;
            }

            Order::whereIn('id', $lines->pluck('id'))->update([
                'payment_status'       => 'verified',
                'payment_reference'    => $payment->stripe_payment_intent_id ?: $payment->stripe_session_id,
                'payment_submitted_at' => now(),
                'payment_verified_at'  => now(),
                // Left null on purpose. This column names the *administrator*
                // who checked a payment by hand; writing a user id here for a
                // gateway settlement would put a person's name against a
                // decision they did not make. The note says who did.
                'payment_verified_by'  => null,
                'payment_note'         => 'Paid by card and confirmed by Stripe.',
            ]);

            OrderEvent::create([
                'reference'   => $reference,
                'order_id'    => $first->id,
                // The journey does not move. Where the goods are and whether
                // they are paid for are separate facts, and this event is
                // about the second one.
                'status'      => $first->status,
                'title'       => 'Payment verified',
                'note'        => 'We have received your payment.',
                'happened_at' => now(),
            ]);
        });

        return self::HANDLED;
    }

    /**
     * A delayed payment method failed after the session completed.
     *
     * The order goes back to owing money so the shopper can try again. It is
     * not moved to `rejected`: in this system that word means an administrator
     * looked for the money and could not find it.
     */
    private function fail(Event $event): string
    {
        $session = $event->data->object;
        $reference = $this->reference($session);

        $this->touchPayment($session, Payment::FAILED, [
            'failure_message' => 'The payment did not complete.',
        ]);

        if ($reference === null) {
            return self::IGNORED;
        }

        $this->reopen($reference, 'Payment attempt did not complete', 'The payment did not go through. You can try again.');

        return self::HANDLED;
    }

    /** The session lapsed unused. The order is still payable. */
    private function expire(Event $event): string
    {
        $session = $event->data->object;
        $reference = $this->reference($session);

        $this->touchPayment($session, Payment::EXPIRED);

        if ($reference === null) {
            return self::IGNORED;
        }

        $this->reopen($reference, 'Payment session expired', 'The payment page timed out. You can start again when you are ready.');

        return self::HANDLED;
    }

    /**
     * Put an unsettled order back to awaiting payment.
     *
     * Never touches an order that is already `verified` — a stale expiry for a
     * superseded session must not undo a payment that went through on a later
     * one.
     */
    private function reopen(string $reference, string $title, string $note): void
    {
        DB::transaction(function () use ($reference, $title, $note) {
            $lines = Order::where('reference', $reference)->lockForUpdate()->get();

            if ($lines->isEmpty()) {
                return;
            }

            $first = $lines->first();
            $current = (string) ($first->payment_status ?? 'not_required');

            if (! in_array($current, self::MOVEABLE, true)) {
                return;
            }

            Order::whereIn('id', $lines->pluck('id'))->update([
                'payment_status' => 'awaiting_payment',
            ]);

            OrderEvent::create([
                'reference'   => $reference,
                'order_id'    => $first->id,
                'status'      => $first->status,
                'title'       => $title,
                'note'        => $note,
                'happened_at' => now(),
            ]);
        });
    }

    /**
     * A refund happened at Stripe. Write it down and stop.
     *
     * Deliberately changes no order state. A refund can be partial, can be
     * issued for a delivery that already happened, and may or may not mean the
     * order is cancelled — that is a judgement, and this release does not make
     * it automatically. Nor does it touch a vendor wallet: money owed to a
     * seller is settled through the wallet ledger, not by a gateway event.
     */
    private function recordRefund(Event $event): string
    {
        $charge = $event->data->object;

        $payment = Payment::where('stripe_charge_id', $charge->id)
            ->orWhere('stripe_payment_intent_id', $charge->payment_intent ?? '__none__')
            ->first();

        if (! $payment) {
            return self::IGNORED;
        }

        $refunded = (int) ($charge->amount_refunded ?? 0);

        $payment->update([
            'refunded_amount_minor' => $refunded,
            'status' => $refunded >= (int) $payment->amount_minor ? Payment::REFUNDED : $payment->status,
            'stripe_charge_id' => $charge->id,
        ]);

        Log::info('Stripe refund recorded', [
            'reference' => $payment->reference,
            'refunded_minor' => $refunded,
        ]);

        return self::HANDLED;
    }

    /** A dispute was opened. Recorded for a human; nothing moves. */
    private function recordDispute(Event $event): string
    {
        $dispute = $event->data->object;

        $payment = Payment::where('stripe_charge_id', $dispute->charge ?? '__none__')
            ->orWhere('stripe_payment_intent_id', $dispute->payment_intent ?? '__none__')
            ->first();

        if (! $payment) {
            return self::IGNORED;
        }

        $payment->update(['status' => Payment::DISPUTED]);

        Log::warning('Stripe dispute opened', ['reference' => $payment->reference]);

        return self::HANDLED;
    }

    /* ---------------------------------------------------------------- */

    /**
     * Update the `payments` row for a session, creating it if the webhook beat
     * the response that created it.
     *
     * @param  array<string, mixed>  $extra
     */
    private function touchPayment(object $session, string $status, array $extra = []): Payment
    {
        $reference = $this->reference($session);
        $currency = strtoupper((string) ($session->currency ?? config('stripe.currency', Money::BASE)));

        $intent = is_string($session->payment_intent ?? null) ? $session->payment_intent : null;

        // `stripe_payment_intent_id` is unique, so writing an intent already
        // held by another row would throw — and a throw here answers 500,
        // which makes Stripe retry an event that will fail again every time.
        //
        // In practice each session has its own PaymentIntent, so this only
        // triggers on genuinely odd input. Dropping the duplicate rather than
        // crashing keeps the endpoint answering, and the row that already
        // holds the intent is the one that matters anyway.
        if ($intent !== null
            && Payment::where('stripe_payment_intent_id', $intent)
                ->where('stripe_session_id', '!=', $session->id)
                ->exists()
        ) {
            $intent = null;
        }

        return Payment::updateOrCreate(
            ['stripe_session_id' => $session->id],
            array_merge([
                'reference'    => $reference ?? '',
                'provider'     => Payment::STRIPE,
                'status'       => $status,
                'currency'     => $currency,
                // Stripe's own figure, in the minor unit it was charged in.
                // Never recomputed from a decimal here — reconciliation is a
                // comparison of two integers or it is not reconciliation.
                'amount_minor' => (int) ($session->amount_total ?? 0),
                'stripe_payment_intent_id' => $intent,
                'raw' => Payment::redact((array) $session->toArray()),
            ], $extra),
        );
    }

    /** The order this object belongs to, from the metadata we set. */
    private function reference(object $session): ?string
    {
        $metadata = $session->metadata ?? null;
        $fromMetadata = is_object($metadata) ? ($metadata->order_reference ?? null) : null;

        $reference = $fromMetadata ?: ($session->client_reference_id ?? null);

        return is_string($reference) && $reference !== '' ? $reference : null;
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) ($e->errorInfo[1] ?? '');

        return in_array((string) $e->getCode(), ['23000', '23505'], true)
            || in_array($code, ['1062', '19'], true);
    }
}
