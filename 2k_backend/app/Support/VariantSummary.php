<?php

namespace App\Support;

use App\Models\Product;

/**
 * What a product is worth and how many there are, when it sells by variant.
 *
 * For a product that sells by combination the parent row is not the
 * commercial unit — the variants are. `products.stock` on such a product is
 * meaningless (an iPhone 15 does not have a stock; a Blue 256GB does), and
 * `products.new_price` is at best the cheapest of them and at worst unrelated.
 *
 * Reading the parent row anyway is exactly the bug this exists to stop: an
 * iPhone with five Black 128GBs, three Black 256GBs, seven Blue 128GBs and two
 * Blue 256GBs — seventeen sellable units — was being rendered "Out of stock"
 * on every grid because the parent row said zero.
 *
 * Two ways in, so listings and the product page can share the rule without
 * sharing a query shape:
 *
 *   - `fromAggregates()` reads the subquery columns the listing adds, so a
 *     grid of twenty-four cards costs no extra queries at all
 *   - `fromRelation()` reads variants already loaded, for the detail page
 */
class VariantSummary
{
    public function __construct(
        public readonly bool $hasVariants,
        /** Units across every live combination. */
        public readonly int $stock,
        /** The cheapest live combination — what "from" refers to. */
        public readonly float $priceFrom,
        /** The dearest, so the page can tell a single price from a range. */
        public readonly float $priceTo,
    ) {}

    public static function none(): self
    {
        return new self(false, 0, 0.0, 0.0);
    }

    /** True when the combinations do not all cost the same. */
    public function isRange(): bool
    {
        return $this->hasVariants && $this->priceTo > $this->priceFrom;
    }

    public function inStock(): bool
    {
        return $this->stock > 0;
    }

    /**
     * From the aggregate columns a listing query selects.
     *
     * `variants_min_price` and `variants_max_price` are MIN/MAX over the
     * variants' own `price`, which SQL computes ignoring nulls — so a variant
     * that inherits the product's price is invisible to them. That is what
     * `variants_inheriting` is for: when any variant inherits, the product's
     * own price is a real price point and has to be folded into the range.
     */
    public static function fromAggregates(Product $product): self
    {
        if (! ($product->variants_exists ?? false)) {
            return self::none();
        }

        $parent     = (float) $product->new_price;
        $inheriting = (int) ($product->variants_inheriting ?? 0);

        $prices = [];
        if ($product->variants_min_price !== null) $prices[] = (float) $product->variants_min_price;
        if ($product->variants_max_price !== null) $prices[] = (float) $product->variants_max_price;
        if ($inheriting > 0) $prices[] = $parent;

        return new self(
            true,
            (int) ($product->variants_stock ?? 0),
            $prices ? min($prices) : $parent,
            $prices ? max($prices) : $parent,
        );
    }

    /** From variants already loaded on the model. */
    public static function fromRelation(Product $product): self
    {
        if (! $product->relationLoaded('variants')) {
            return self::none();
        }

        $live = $product->variants->where('is_active', true);

        if ($live->isEmpty()) {
            return self::none();
        }

        $prices = $live->map(fn ($variant) => $variant->unitPrice($product));

        return new self(
            true,
            (int) $live->sum('stock'),
            (float) $prices->min(),
            (float) $prices->max(),
        );
    }
}
