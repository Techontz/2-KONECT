<?php

namespace App\Http\Resources;

use App\Support\Media;
use App\Support\Money;
use App\Support\Sourcing;
use App\Support\VariantSummary;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The compact product shape used by every grid, shelf and carousel.
 *
 * Deliberately smaller than the detail payload: listing pages render dozens of
 * these at a time, so descriptions, attributes and reviews are left out.
 */
class ProductCardResource extends JsonResource
{
    public function toArray($request): array
    {
        $images = Media::urls($this->images->pluck('image'));

        // A product that sells by combination is priced and counted by its
        // variants, not by its own row. See App\Support\VariantSummary.
        $variants = VariantSummary::fromAggregates($this->resource);

        $stock = $variants->hasVariants ? $variants->stock : (int) $this->stock;

        // `reviews_avg_rating` / `reviews_count` are supplied by withAvg/withCount
        // on the listing queries so this never triggers a per-row query.
        $rating = $this->reviews_avg_rating
            ?? ($this->relationLoaded('reviews') ? $this->reviews->avg('rating') : null);
        $reviewCount = $this->reviews_count
            ?? ($this->relationLoaded('reviews') ? $this->reviews->count() : 0);

        return [
            'id'    => $this->id,
            'name'  => $this->name,
            'image' => $images[0] ?? null,
            'images' => $images,
            // The cheapest combination, when there are combinations. `price_from`
            // tells the card to say "From" rather than quoting it as *the*
            // price, because which one the shopper pays depends on what they
            // choose — and the dearest here is 19% above the cheapest.
            'price' => $variants->hasVariants
                ? Money::payload($variants->priceFrom, null)
                : Money::payload(
                    // Converted from the seller's own currency first. Without
                    // this a listing quoted at $20 renders as "TZS 20".
                    $this->resource->inBaseCurrency((float) $this->new_price),
                    $this->old_price !== null ? $this->resource->inBaseCurrency((float) $this->old_price) : null,
                ),
            'price_from' => $variants->isRange(),
            'rating' => [
                'average' => $rating ? round((float) $rating, 1) : 0.0,
                'count'   => (int) $reviewCount,
            ],
            'stock'    => $stock,
            'in_stock' => $stock > 0,
            'category' => $this->whenLoaded('category', fn () => [
                'id'   => $this->category->id,
                'name' => $this->category->name,
            ]),
            'subcategory' => $this->whenLoaded('subcategory', fn () => [
                'id'   => $this->subcategory->id,
                'name' => $this->subcategory->name,
            ]),
            'vendor' => $this->whenLoaded('vendor', fn () => [
                'id'          => $this->vendor->id,
                'name'        => $this->vendor->business_name,
                // Drives the card's verified checkmark, so a shopper can weigh
                // the seller without opening the product.
                'is_verified' => (bool) $this->vendor->is_verified,
            ]),

            // Where the item is and when it lands — the distinction the whole
            // storefront is organised around.
            'sourcing' => Sourcing::payload(
                $this->availability,
                $this->source_country,
                $this->lead_time_min_days,
                $this->lead_time_max_days,
                $this->shipping_method,
                $this->fulfilment_location,
            ),
            // Flags, never the tables themselves. A grid of twenty-four cards
            // has no use for a tier list or a variant matrix, and the listing
            // query supplies these through `withExists`, so neither costs a
            // query per row. The card shows a small "Bulk pricing" label; the
            // detail page is where the numbers live.
            'has_bulk_pricing' => (bool) ($this->price_tiers_exists ?? false),
            'has_options'      => (bool) ($this->variants_exists ?? false),

            'badges' => [
                // Mirrors the reference storefront's card badges. Derived from
                // real columns — nothing here is decorative invention.
                'low_stock'  => $stock > 0 && $stock <= 5,
                'out_of_stock' => $stock <= 0,
                // A "was" price on the parent says nothing about a variant's
                // price, so the discount flag stands down for a variant
                // product rather than advertising a saving nobody gets.
                'discounted' => ! $variants->hasVariants
                    && $this->old_price !== null
                    && (float) $this->old_price > (float) $this->new_price,
            ],
        ];
    }
}
