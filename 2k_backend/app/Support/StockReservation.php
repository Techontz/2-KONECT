<?php

namespace App\Support;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductVariant;

/**
 * Putting reserved units back when an order line is withdrawn.
 *
 * Checkout takes stock from whichever row is actually counting it, and a
 * cancellation has to give it back to the same row. Getting that wrong is not
 * a rounding error: crediting the product when a variant was sold inflates the
 * catalogue's stock permanently, and crediting anything at all for an import
 * invents units that were never on a shelf.
 *
 * ---- the rule, in the order it must be asked ----
 *
 *   1. A variant tracks its own stock, so it is always restored — including
 *      for an import. The units exist as a specific combination, unlike an
 *      import of the product itself, which is bought in per order.
 *   2. Otherwise, an import reserved nothing. There is nothing to return.
 *   3. Otherwise the units came from the chosen offer, or from the product's
 *      own count when no alternative offer was named.
 *
 * This mirrors {@see \App\Http\Controllers\Api\Shop\OrderController::cancel},
 * which is the most complete of the three copies of this logic in the codebase
 * and the one the customer-facing cancellation already uses. It is stated once
 * here so a fourth caller does not have to re-derive it — the legacy vendor
 * cancellation did not have it at all, and simply lost the units.
 */
class StockReservation
{
    /**
     * Return this line's reserved units to whatever row holds them.
     *
     * Callers must ensure a line cannot be restored twice — cancelling an
     * already-cancelled order would otherwise credit the same units again.
     * Every caller does this by refusing to act on a closed order, which is
     * the check that belongs to them rather than to this class: only they know
     * which statuses they consider closed.
     */
    public static function restore(Order $line): void
    {
        $quantity = (int) $line->quantity;

        if ($quantity <= 0) {
            return;
        }

        if ($line->product_variant_id) {
            ProductVariant::where('id', $line->product_variant_id)->increment('stock', $quantity);

            return;
        }

        if (Sourcing::normalise($line->fulfilment_type) === Sourcing::IMPORT) {
            // Never reserved anything, so there is nothing to give back.
            return;
        }

        $line->offer_id
            ? ProductOffer::where('id', $line->offer_id)->increment('stock', $quantity)
            : Product::where('id', $line->product_id)->increment('stock', $quantity);
    }
}
