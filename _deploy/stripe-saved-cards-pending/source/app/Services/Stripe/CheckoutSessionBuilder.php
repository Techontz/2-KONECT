<?php

namespace App\Services\Stripe;

use App\Models\Order;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Stripe\Checkout\Session;

/**
 * Turning an order into a Stripe Checkout Session.
 *
 * The amount is recomputed here from the order rows and nothing else. The
 * client asks for a session by reference; it does not say what the order costs,
 * and if it did it would not be read. That is not defensiveness for its own
 * sake — the whole point of a hosted checkout is that the shopper is charged a
 * figure the server decided.
 */
class CheckoutSessionBuilder
{
    public function __construct(private readonly StripeClientFactory $stripe)
    {
    }

    /**
     * Create the session and the `payments` row that records it.
     *
     * @param  Collection<int, Order>  $lines  Every line of one checkout.
     * @return array{url: string, session_id: string, payment: Payment}
     */
    public function create(Collection $lines): array
    {
        $first = $lines->first();
        $reference = (string) $first->reference;
        $currency = strtoupper((string) config('stripe.currency', Money::BASE));

        // The total, from the database. `total` is the line's own money and
        // `delivery_fee` sits on one line of the checkout — summing both across
        // the group is exactly how OrderController presents the order back to
        // the shopper, so the figure on the Stripe page is the figure on the
        // order page.
        $amount = round((float) $lines->sum('total') + (float) $lines->sum('delivery_fee'), 2);

        // The only conversion, and it lives in Money. TZS is a two-decimal
        // currency to Stripe despite being quoted in whole shillings, so this
        // multiplies by 100 — verified against Stripe's published zero-decimal
        // list rather than assumed.
        $amountMinor = Money::toMinorUnits($amount, $currency);

        $session = $this->stripe->make()->checkout->sessions->create(
            $this->params($lines, $reference, $currency, $amountMinor),
            // Two taps on "Pay" must not create two sessions. Keyed on the
            // reference and the amount, so a genuine retry after the basket
            // changed still gets a new one.
            ['idempotency_key' => 'checkout_' . $reference . '_' . $amountMinor],
        );

        $payment = Payment::updateOrCreate(
            ['stripe_session_id' => $session->id],
            [
                'reference'    => $reference,
                'user_id'      => $first->user_id,
                'provider'     => Payment::STRIPE,
                'status'       => Payment::PENDING,
                'currency'     => $currency,
                'amount_minor' => $amountMinor,
                'stripe_payment_intent_id' => is_string($session->payment_intent)
                    ? $session->payment_intent
                    : null,
                'raw' => Payment::redact($session->toArray()),
            ],
        );

        return [
            'url'        => (string) $session->url,
            'session_id' => (string) $session->id,
            'payment'    => $payment,
        ];
    }

    /**
     * @param  Collection<int, Order>  $lines
     * @return array<string, mixed>
     */
    private function params(Collection $lines, string $reference, string $currency, int $amountMinor): array
    {
        $first = $lines->first();

        return [
            'mode' => 'payment',

            // `payment_method_types` is deliberately absent. Setting it turns
            // off dynamic payment methods, which is what lets Stripe pick and
            // rank what actually works for this shopper, and moves the decision
            // out of the Dashboard and into a deployment.
            'line_items' => $this->lineItems($lines, $currency, $amountMinor),

            // ---- who is paying, and whether their card can be offered back ----
            //
            // A shopper who has paid before already has a Stripe Customer, and
            // naming it here is what makes Stripe offer their saved card
            // instead of an empty form. A first-time shopper has none, so one
            // is created and the webhook writes its id onto the user.
            //
            // `setup_future_usage` is what actually saves the card. Without it
            // Stripe charges and forgets, and every purchase looks like a
            // stranger's. It is `on_session` rather than `off_session` because
            // 2KONECT never charges anybody who is not standing at the
            // checkout — there is no subscription and no stored-card billing.
            //
            // No card detail reaches this application at any point. Stripe
            // holds the number; we hold an opaque customer id.
            ...$this->customerParams($first),

            'payment_intent_data' => [
                'setup_future_usage' => 'on_session',
                'metadata' => [
                    'order_reference' => $reference,
                ],
            ],

            // Both correlate the payment back to the order. `client_reference_id`
            // is the one that shows in the Dashboard; the metadata is what the
            // webhook reads, because it survives on the PaymentIntent too.
            'client_reference_id' => $reference,
            'metadata' => [
                'order_reference' => $reference,
                'user_id'         => (string) $first->user_id,
            ],
            // Informational only. The order page refetches and shows whatever
            // the webhook has recorded; neither of these settles anything, and
            // a shopper who edits the URL achieves nothing.
            'success_url' => $this->returnUrl($reference, 'success'),
            'cancel_url'  => $this->returnUrl($reference, 'cancelled'),

            'expires_at' => now()
                ->addMinutes(max(30, (int) config('stripe.session_ttl_minutes', 60)))
                ->getTimestamp(),

            // Labels the flow in the Dashboard so several checkout shapes can
            // be told apart later. The suffix keeps it unique per session.
            'integration_identifier' => 'konect2k_' . Str::lower(Str::random(8)),
        ];
    }

    /**
     * The basket, as Stripe will show it.
     *
     * One line per product so the shopper recognises what they are paying for,
     * plus delivery when it applies. The *sum* is what matters and it is
     * recomputed above; these are priced from the same rows, so the two agree
     * by construction rather than by coincidence.
     *
     * Delivery appears only when the order actually carries a fee. An imported
     * order does not — what the last mile costs is not known until the goods
     * have landed — and inventing a line for it here would contradict the rule
     * CheckoutPolicy enforces.
     *
     * @param  Collection<int, Order>  $lines
     * @return list<array<string, mixed>>
     */
    private function lineItems(Collection $lines, string $currency, int $amountMinor): array
    {
        $items = [];
        $running = 0;

        foreach ($lines as $line) {
            $lineMinor = Money::toMinorUnits((float) $line->total, $currency);
            $running += $lineMinor;

            $items[] = [
                'quantity' => 1,
                'price_data' => [
                    'currency' => strtolower($currency),
                    // The line's whole cost as one unit. Stripe would otherwise
                    // multiply a unit price by the quantity and round it a
                    // second time, which can disagree with the order total by a
                    // minor unit on a tiered price.
                    'unit_amount' => $lineMinor,
                    'product_data' => [
                        'name' => $this->itemName($line),
                    ],
                ],
            ];
        }

        $delivery = $amountMinor - $running;

        if ($delivery > 0) {
            $items[] = [
                'quantity' => 1,
                'price_data' => [
                    'currency'    => strtolower($currency),
                    'unit_amount' => $delivery,
                    'product_data' => ['name' => 'Delivery'],
                ],
            ];
        }

        return $items;
    }

    private function itemName(Order $line): string
    {
        $name = $line->product?->name ?: 'Item';

        if ((int) $line->quantity > 1) {
            $name .= ' × ' . (int) $line->quantity;
        }

        // Stripe caps this, and a long seller-written title would otherwise be
        // rejected at the API rather than trimmed on the page.
        return Str::limit($name, 250, '');
    }

    /**
     * How this shopper is identified to Stripe.
     *
     * Returns an existing customer when we have one, so their saved cards are
     * offered; otherwise asks Stripe to create one, which the webhook then
     * records against the user. Either way the shopper's email is passed so
     * Stripe can send a receipt and so the Dashboard shows a person rather
     * than an anonymous charge.
     *
     * `customer` and `customer_creation` are mutually exclusive — sending both
     * is an API error — which is why this is one method returning one shape or
     * the other rather than two flags set independently.
     *
     * @return array<string, mixed>
     */
    private function customerParams(Order $line): array
    {
        $user = $line->buyer;

        if ($user?->stripe_customer_id) {
            return ['customer' => $user->stripe_customer_id];
        }

        return array_filter([
            'customer_creation' => 'always',
            'customer_email'    => $user?->email,
        ]);
    }

    private function returnUrl(string $reference, string $outcome): string
    {
        return sprintf(
            '%s/account/orders/%s/?stripe=%s',
            rtrim((string) config('stripe.return_base_url'), '/'),
            rawurlencode($reference),
            $outcome,
        );
    }
}
