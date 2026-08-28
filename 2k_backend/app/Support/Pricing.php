<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductVariant;

/**
 * Works out what a line actually costs, and whether it can be bought.
 *
 * One place, used by the cart quote and by order creation, so the number the
 * shopper is shown and the number they are charged come from the same code
 * reading the same rows. Nothing here consults anything the browser sent
 * beyond the ids and the quantity.
 *
 * Three things can set a unit price, in this order of precedence:
 *
 *   1. the variant, when it carries one of its own
 *   2. the alternative offer, when one was chosen
 *   3. the product's `new_price`
 *
 * Quantity tiers are breaks on the *product's* price, so they apply only when
 * (3) is what the line landed on — including a variant that inherits rather
 * than sets a price, which is the ordinary "all sizes cost the same, buy ten
 * and save" case. A variant or offer that names its own figure has opted out
 * of the product's schedule, and quietly charging it the product's bulk rate
 * would be wrong in the seller's favour or the shopper's, depending on which
 * way the prices happen to fall.
 */
class Pricing
{
    /**
     * @return array{
     *   unit_price: float, base_price: float, quantity: int, total: float,
     *   stock: int, availability: string, purchasable: bool,
     *   tier: array|null, tiers_apply: bool, reason: string|null
     * }
     */
    public static function resolve(
        Product $product,
        ?ProductOffer $offer,
        ?ProductVariant $variant,
        int $quantity,
    ): array {
        $availability = Sourcing::normalise($offer?->availability ?? $product->availability);

        // Which of the three sources sets the price, and does that leave the
        // product's own quantity schedule in play?
        $variantSetsPrice = $variant !== null && $variant->price !== null;
        $offerSetsPrice   = $offer !== null && $offer->price !== null;

        if ($variantSetsPrice) {
            $basePrice = (float) $variant->price;
        } elseif ($offerSetsPrice) {
            $basePrice = (float) $offer->price;
        } else {
            $basePrice = (float) $product->new_price;
        }

        $tiersApply = ! $variantSetsPrice && ! $offerSetsPrice;

        $tier = $tiersApply ? self::tierFor($product, $quantity) : null;
        $unitPrice = $tier !== null ? (float) $tier->unit_price : $basePrice;

        // ---- the seller's currency, converted once ----
        //
        // A seller's figure is stored exactly as they typed it, in the currency
        // they chose; their $20 stays 20 and is never overwritten with 50,000.
        // This is the one place it becomes canonical shillings, because this is
        // the one place a price is resolved — offers, variants and quantity
        // tiers all pass through here and all inherit the listing's currency,
        // so there is nothing further downstream that needs to know.
        //
        // Everything after this point is TZS, as it has always been. An order
        // priced from a dollar listing and one priced from a shilling listing
        // are the same kind of thing by the time either is written down.
        $currency = $product->base_currency ?? Currency::BASE;

        if (Currency::normalise($currency) !== Currency::BASE) {
            $basePrice = Currency::toBase($basePrice, $currency);
            $unitPrice = Currency::toBase($unitPrice, $currency);
        }

        // Stock narrows as the choice narrows: a variant's own count beats the
        // offer's, which beats the product's.
        if ($variant !== null) {
            $stock = (int) $variant->stock;
        } elseif ($offer !== null) {
            $stock = (int) $offer->stock;
        } else {
            $stock = (int) $product->stock;
        }

        // An import is sourced on demand, so a zero on hand does not make it
        // unbuyable — only local stock actually runs out. This is the rule the
        // storefront has always used and it is preserved exactly.
        $limited = $availability === Sourcing::LOCAL || $variant !== null;

        $purchasable = true;
        $reason      = null;

        if ($variant !== null && ! $variant->is_active) {
            $purchasable = false;
            $reason      = 'That combination is no longer available.';
        } elseif ($limited && $stock <= 0) {
            $purchasable = false;
            $reason      = sprintf('"%s" is out of stock.', $product->name);
        } elseif ($limited && $stock < $quantity) {
            $purchasable = false;
            $reason      = sprintf('Only %d left of "%s".', $stock, $product->name);
        }

        return [
            'unit_price'   => round($unitPrice, 2),
            'base_price'   => round($basePrice, 2),
            'quantity'     => $quantity,
            'total'        => round($unitPrice * $quantity, 2),
            'stock'        => $stock,
            'availability' => $availability,
            'purchasable'  => $purchasable,
            'tier'         => $tier?->payload(),
            'tiers_apply'  => $tiersApply,
            'reason'       => $reason,
        ];
    }

    /**
     * The tier covering this quantity, or null.
     *
     * Reads the already-loaded relation when there is one, so resolving a
     * basket of twenty lines does not issue twenty tier queries.
     */
    public static function tierFor(Product $product, int $quantity): ?\App\Models\ProductPriceTier
    {
        $tiers = $product->relationLoaded('priceTiers')
            ? $product->priceTiers
            : $product->priceTiers()->orderBy('min_quantity')->get();

        if ($tiers->isEmpty()) {
            return null;
        }

        // Highest matching minimum wins. Ranges are validated non-overlapping
        // on the way in, so at most one tier can match — but ordering by
        // `min_quantity` descending also makes a hand-edited row that does
        // overlap resolve to the deepest discount rather than to whichever
        // happened to be inserted first.
        return $tiers
            ->sortByDesc('min_quantity')
            ->first(fn ($tier) => $tier->covers($quantity));
    }
}
