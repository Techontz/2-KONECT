<?php

namespace App\Support;

use App\Models\CheckoutPaymentChannel;
use Illuminate\Support\Collection;

/**
 * Which payment methods an order may use, and whether delivery is part of it.
 *
 * One place decides both, because they are the same decision: an order that
 * contains something 2KONECT has to buy abroad is prepaid and its delivery is
 * arranged later, while an order picked off a local shelf can be paid at the
 * door and delivered with it.
 *
 * The distinction is not new and no new field records it. A line's
 * `fulfilment_type` is already `local` or `import`, written at checkout from
 * the product's own `availability`, and it is per line — so a basket holding
 * one of each is already representable and this class simply reads it.
 *
 * ---- why an import cannot be cash on delivery ----
 *
 * Cash on delivery works because the goods already exist: if the buyer refuses
 * them, the seller still has them. An import does not exist yet. 2KONECT pays a
 * supplier abroad, freights it in and clears it, and only then is there
 * anything to refuse — by which point the money is spent and unrecoverable.
 * "Pay on delivery" on that order is not a payment term, it is the marketplace
 * lending the full value of the goods to a stranger, per order, with no
 * recourse. So it is refused here, in the one place every route goes through,
 * rather than hidden in the interface.
 *
 * ---- mixed baskets ----
 *
 * A checkout writes one row per line but a single `payment_method` covers all
 * of them, so a basket with one import in it is prepaid in full. Splitting it
 * into two payments is the other defensible answer, but it would mean two
 * references, two verifications and a part-paid order — a change to how orders
 * are grouped, not a rule about them. The customer is told plainly why.
 */
class CheckoutPolicy
{
    /**
     * Does this set of lines contain anything sourced from abroad?
     *
     * @param  iterable<array{fulfilment_type?:string}|object>  $lines
     */
    public static function hasImport(iterable $lines): bool
    {
        foreach ($lines as $line) {
            $type = is_array($line) ? ($line['fulfilment_type'] ?? null) : ($line->fulfilment_type ?? null);

            if (Sourcing::normalise($type) === Sourcing::IMPORT) {
                return true;
            }
        }

        return false;
    }

    /**
     * Whether an order carrying these lines must be paid before it is worked.
     */
    public static function requiresPrepayment(iterable $lines): bool
    {
        return self::hasImport($lines);
    }

    /**
     * The payment method codes this order may legitimately use.
     *
     * Prepaid orders get only the channels an administrator has switched on;
     * if none are, the list is empty and checkout says so rather than falling
     * back to cash on delivery.
     *
     * @return list<string>
     */
    public static function allowedMethods(bool $prepaid): array
    {
        $channels = CheckoutPaymentChannel::active()->pluck('code')->all();

        if ($prepaid) {
            return array_values(array_filter(
                $channels,
                fn (string $code) => $code !== CheckoutPaymentChannel::CASH_ON_DELIVERY,
            ));
        }

        // A local order keeps what it has always had, plus anything switched
        // on. Cash on delivery is not a configured channel — it needs no till
        // number — so it is named here.
        return array_values(array_unique(array_merge(
            [CheckoutPaymentChannel::CASH_ON_DELIVERY],
            $channels,
        )));
    }

    /**
     * The message shown when cash on delivery is asked for on an import.
     *
     * Returned by the API in English; the storefront has the same sentence in
     * every language it ships and prefers its own.
     */
    public static function codRefusedMessage(): string
    {
        return 'Cash on Delivery is not available for products ordered from abroad. '
            . 'Please pay using Mobile Money or Lipa Namba.';
    }

    /**
     * Whether a delivery fee may be attached at checkout.
     *
     * Never for an import. What arrives from abroad is not on a courier's van
     * the day it is bought — it is sourced, freighted and cleared first, and
     * only once it has landed does anyone know what moving it the last mile
     * costs. Charging a flat fee at checkout invents that number weeks early.
     *
     * Local orders are unchanged: the goods are here and the fee is knowable.
     */
    public static function chargesDeliveryAtCheckout(iterable $lines): bool
    {
        return ! self::hasImport($lines);
    }

    /** The initial payment state for an order paid by this method. */
    public static function initialPaymentStatus(string $method): string
    {
        return $method === CheckoutPaymentChannel::CASH_ON_DELIVERY
            ? 'not_required'
            : 'awaiting_payment';
    }

    /** @return Collection<int, CheckoutPaymentChannel> */
    public static function channelsFor(bool $prepaid): Collection
    {
        return CheckoutPaymentChannel::active()
            ->when($prepaid, fn ($q) => $q->where('code', '!=', CheckoutPaymentChannel::CASH_ON_DELIVERY))
            ->get();
    }
}
