<?php

namespace App\Support;

use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;

/**
 * Whether an order may be worked on yet.
 *
 * There is exactly one rule here and it is worth stating plainly: an order for
 * goods 2KONECT has to buy abroad cannot be processed until the customer has
 * actually paid for it.
 *
 * That is not a preference about tidy queues. An import is bought to order —
 * 2KONECT pays a supplier abroad, freights it in and clears it — so work
 * started before the money arrives is money spent on stock nobody has bought.
 * {@see CheckoutPolicy} already refuses cash on delivery for these orders at
 * checkout for the same reason. This is the other half of that rule: refusing
 * it at checkout is pointless if the order can be advanced afterwards anyway.
 *
 * A local order is unaffected. The goods are on a shelf in Dar es Salaam, and
 * if the buyer refuses them at the door the seller still has them. Pay on
 * delivery is a legitimate, deliberate arrangement and nothing here touches it.
 *
 * ---- why this is a class and not four `if` statements ----
 *
 * Because there were four places that could move an order forward — the seller
 * console, two legacy vendor endpoints and two admin actions — and none of them
 * checked. A rule copied into four call sites is a rule that will be enforced
 * in three of them after the next change. Every write goes through
 * {@see self::assertProcessable()}; the vendor's own list goes through
 * {@see self::scopeProcessable()}; and neither can drift from the other because
 * {@see self::awaitsPrepayment()} is what both are asking.
 */
class OrderGate
{
    /**
     * The only payment state that counts as paid.
     *
     * `verified` is written by the Stripe webhook after a signed event, or by
     * an administrator who has actually looked for the money. Nothing else
     * qualifies — `awaiting_payment` is a bill, and `awaiting_verification` is
     * a customer's claim to have paid, which is not the same as having paid.
     */
    public const PAID = 'verified';

    /** Owes nothing: cash on delivery. Only ever legitimate on a local order. */
    public const NOT_REQUIRED = 'not_required';

    public static function isImport(Order $order): bool
    {
        return Sourcing::normalise($order->fulfilment_type) === Sourcing::IMPORT;
    }

    /**
     * An import that has not been paid for.
     *
     * `not_required` is deliberately NOT treated as settled here. It means cash
     * on delivery, which CheckoutPolicy refuses for imports — so an import
     * carrying it is either historic data or something that got in another way,
     * and in both cases the safe reading is that nobody has paid.
     */
    public static function awaitsPrepayment(Order $order): bool
    {
        return self::isImport($order) && (string) $order->payment_status !== self::PAID;
    }

    /** Whether this order may legitimately be advanced, dispatched or completed. */
    public static function processable(Order $order): bool
    {
        return ! self::awaitsPrepayment($order);
    }

    /**
     * Refuse to move an unpaid import, in the caller's own idiom.
     *
     * Returns null when the order may be worked on, so a controller can do
     * `if ($m = OrderGate::refusal($order)) return response()->json(...)` and a
     * Filament action can put the same sentence in a notification.
     */
    public static function refusal(Order $order): ?string
    {
        return self::awaitsPrepayment($order) ? self::MESSAGE : null;
    }

    public const MESSAGE = 'Import orders must be paid before they can be processed.';

    /**
     * Restrict a query to the orders a seller may act on.
     *
     * Applied to the query rather than to the rendered list on purpose. Hiding
     * an unpaid import in the interface leaves it reachable by anyone who calls
     * the endpoint directly, and the seller console is not the only client —
     * the Flutter app reads the same JSON.
     *
     * @param  Builder<Order>  $query
     * @return Builder<Order>
     */
    public static function scopeProcessable(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->where('fulfilment_type', '!=', Sourcing::IMPORT)
                ->orWhereNull('fulfilment_type')
                ->orWhere('payment_status', self::PAID);
        });
    }

    /**
     * What a person should be told the payment state is.
     *
     * One vocabulary for the seller console, the admin table and the customer's
     * own order page, so a vendor asking "has this been paid?" and an admin
     * answering are reading the same word.
     *
     * @return array{code:string,label:string,tone:string}
     */
    public static function paymentBadge(Order $order): array
    {
        $status = (string) ($order->payment_status ?: self::NOT_REQUIRED);

        $badge = match ($status) {
            self::PAID              => ['Paid', 'success'],
            self::NOT_REQUIRED      => ['Pay on delivery', 'info'],
            'awaiting_verification' => ['Payment being checked', 'warning'],
            'rejected'              => ['Payment failed', 'danger'],
            'refunded'              => ['Refunded', 'danger'],
            'disputed'              => ['Disputed', 'danger'],
            // An import owes money and has not paid it; a local order on a
            // gateway is simply not paid yet and is not being worked either.
            default                 => [self::isImport($order) ? 'Payment required' : 'Awaiting payment', 'danger'],
        };

        return ['code' => $status, 'label' => $badge[0], 'tone' => $badge[1]];
    }

    /**
     * Where the goods are coming from, as a badge.
     *
     * @return array{code:string,label:string,flag:string}
     */
    public static function originBadge(Order $order): array
    {
        return self::isImport($order)
            ? ['code' => Sourcing::IMPORT, 'label' => 'Import order', 'flag' => '🌍']
            : ['code' => Sourcing::LOCAL,  'label' => 'Local order',  'flag' => '🇹🇿'];
    }
}
