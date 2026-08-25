<?php

namespace App\Services\AzamPay;

use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\PaymentCallback;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * What happens when AzamPay says a payment was made.
 *
 * ---- the rule this class exists to enforce ----
 *
 * A callback is a claim, not a fact. AzamPay publishes no way to authenticate
 * one — no signature, no HMAC, no timestamp — so an inbound callback is
 * indistinguishable from a stranger posting the same JSON. Everything below
 * follows from taking that seriously.
 *
 * The previous handler did not. It read `transactionstatus`, and on the word
 * "success" it marked orders paid, decremented stock a second time (order
 * creation had already reserved it), and credited the vendor's wallet — which
 * `completeOrder()` then credited again on delivery. Three irreversible
 * effects, all reachable by anyone who could guess or read a UUID.
 *
 * So this class may move an order into the queue a human works. It may not
 * move money, may not move stock, and may not decide anything is settled:
 *
 *   - never writes `payment_status = 'verified'`
 *   - never touches `orders.status`
 *   - never credits a wallet
 *   - never decrements or restores stock
 *   - never triggers fulfilment
 *
 * The furthest a callback gets an order is `awaiting_verification`, which is
 * exactly where a customer typing a Lipa Namba reference gets it. That state
 * is a queue, not settlement, and only an administrator can leave it. Nothing
 * about the trust model changes because the claim arrived over HTTP instead of
 * through a form.
 *
 * ---- idempotency ----
 *
 * A gateway that receives no answer retries. The record is written first and
 * the database decides the winner, so two callbacks racing produce one effect
 * — an `if` statement here would let both through the gap between the check
 * and the write.
 */
class CallbackProcessor
{
    /** Recorded and acted on: the order moved into the verification queue. */
    public const RECORDED = 'recorded';

    /** Seen this exact callback before. Nothing done, deliberately. */
    public const DUPLICATE = 'already_processed';

    /** Nothing here matches that reference. */
    public const UNKNOWN = 'unknown';

    /** Recorded, but the order was already settled or owes nothing. */
    public const NO_CHANGE = 'no_change';

    /**
     * Payment states a callback is allowed to move an order out of.
     *
     * `verified` is absent because a settled order must never be knocked back
     * into a queue by a replayed callback, and `not_required` is absent
     * because a cash-on-delivery order owes nothing to begin with — a callback
     * claiming otherwise is either a mistake or an attack, and in both cases
     * the right response is to write it down and change nothing.
     */
    private const MOVEABLE = ['awaiting_payment', 'rejected'];

    /**
     * @param  array<string,mixed>  $payload  The callback body, as received.
     * @return array{status:string, reference:?string}
     */
    public function handle(array $payload): array
    {
        $externalId = trim((string) ($payload['utilityref'] ?? ''));
        $providerRef = trim((string) ($payload['reference'] ?? ''));
        $status = strtolower(trim((string) ($payload['transactionstatus'] ?? '')));

        if ($externalId === '') {
            return ['status' => self::UNKNOWN, 'reference' => null];
        }

        // Written before anything is inspected, so that a retry collides with
        // the unique index rather than with a check. A duplicate insert is the
        // whole idempotency guarantee; it must not be reachable around.
        try {
            $record = PaymentCallback::create([
                'provider'           => PaymentCallback::AZAMPAY,
                'external_id'        => $externalId,
                'provider_reference' => $providerRef,
                'status'             => $status !== '' ? $status : 'unknown',
                'amount'             => is_numeric($payload['amount'] ?? null)
                    ? (float) $payload['amount']
                    : null,
                'currency'           => 'TZS',
                'payload'            => PaymentCallback::redact($payload),
            ]);
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                Log::info('AzamPay callback ignored as duplicate', [
                    'external_id' => $externalId,
                ]);

                return ['status' => self::DUPLICATE, 'reference' => null];
            }

            throw $e;
        }

        try {
            return DB::transaction(function () use ($record, $externalId, $status) {
                $lines = Order::where('external_id', $externalId)
                    ->lockForUpdate()
                    ->get();

                if ($lines->isEmpty()) {
                    // Leave no trace for a reference that means nothing to us,
                    // so an unauthenticated caller cannot fill this table by
                    // guessing. `$record` is deleted rather than kept because
                    // it documents nothing.
                    $record->delete();

                    return ['status' => self::UNKNOWN, 'reference' => null];
                }

                $first = $lines->first();
                $record->update(['processed_at' => now()]);

                $outcome = $status === 'success'
                    ? $this->recordClaimedPayment($lines, $record)
                    : $this->recordFailedAttempt($lines, $record, $status);

                return ['status' => $outcome, 'reference' => $first->reference];
            });
        } catch (\Throwable $e) {
            // A half-processed callback must stay retryable. Without this the
            // record would survive a crash and block AzamPay's next attempt
            // forever, which is a worse failure than processing twice.
            $record->delete();

            throw $e;
        }
    }

    /**
     * Somebody says they have paid. Put it in front of a human.
     *
     * This is the same destination a Lipa Namba reference reaches, because it
     * is the same kind of assertion: unverified, from outside, about money.
     */
    private function recordClaimedPayment($lines, PaymentCallback $record): string
    {
        $first = $lines->first();
        $current = (string) ($first->payment_status ?? 'not_required');

        if (! in_array($current, self::MOVEABLE, true)) {
            // Already settled, or nothing was owed. Recorded above; changed
            // here not at all.
            return self::NO_CHANGE;
        }

        Order::where('external_id', $first->external_id)->update([
            'payment_status'       => 'awaiting_verification',
            'payment_reference'    => $record->provider_reference !== ''
                ? $record->provider_reference
                : null,
            'payment_submitted_at' => now(),
        ]);

        OrderEvent::create([
            'reference'   => $first->reference,
            'order_id'    => $first->id,
            // The journey does not move. Money and progress are separate axes
            // and a payment claim says nothing about where the goods are.
            'status'      => $first->status,
            'title'       => 'Payment submitted',
            'note'        => $this->note($lines, $record),
            'happened_at' => now(),
        ]);

        return self::RECORDED;
    }

    /**
     * A failed or unrecognised attempt.
     *
     * The order stays exactly where it was — still owing, still payable — so
     * the customer can try again. It is not moved to `rejected`: in this
     * system that word means an administrator looked for the money and could
     * not find it, and a gateway is not entitled to put words in their mouth.
     */
    private function recordFailedAttempt($lines, PaymentCallback $record, string $status): string
    {
        $first = $lines->first();
        $current = (string) ($first->payment_status ?? 'not_required');

        if (! in_array($current, self::MOVEABLE, true)) {
            return self::NO_CHANGE;
        }

        OrderEvent::create([
            'reference'   => $first->reference,
            'order_id'    => $first->id,
            'status'      => $first->status,
            'title'       => 'Payment attempt did not complete',
            'note'        => 'A mobile money payment was attempted and did not go through'
                . ($status !== '' ? sprintf(' (%s).', $status) : '.')
                . ' You can try again.',
            'happened_at' => now(),
        ]);

        return self::NO_CHANGE;
    }

    /**
     * What the person verifying this payment needs to know.
     *
     * The amount is compared but never enforced, because the callback is not
     * trusted enough to refuse an order on. A mismatch is surfaced to the human
     * who is going to check it against the statement anyway — which is the only
     * place in this flow where the comparison can actually mean something.
     */
    private function note($lines, PaymentCallback $record): string
    {
        $note = 'Waiting for 2KONECT to confirm the payment.';

        $expected = round((float) $lines->sum('total') + (float) $lines->sum('delivery_fee'), 2);
        $claimed = $record->amount !== null ? round((float) $record->amount, 2) : null;

        if ($claimed !== null && abs($claimed - $expected) >= 0.01) {
            $note .= sprintf(
                ' Note: the amount reported (TZS %s) does not match the order total (TZS %s).',
                number_format($claimed),
                number_format($expected),
            );
        }

        return $note;
    }

    /** MySQL 1062 / SQLite 19 / Postgres 23505 all mean the same thing here. */
    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) ($e->errorInfo[1] ?? '');

        return in_array((string) $e->getCode(), ['23000', '23505'], true)
            || in_array($code, ['1062', '19'], true);
    }
}
