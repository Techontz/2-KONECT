<?php

namespace App\Http\Resources;

use App\Support\Media;
use App\Support\Phone;
use App\Support\Money;
use App\Support\Sourcing;
use App\Support\VariantSummary;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Full product payload for the product detail page.
 *
 * Extends the card shape with everything the PDP renders: gallery, description,
 * specifications (the attribute values and the free-form custom_fields column
 * the vendor form writes), seller block and review breakdown.
 */
class ProductDetailResource extends JsonResource
{
    public function toArray($request): array
    {
        $images  = Media::urls($this->images->pluck('image'));
        $reviews = $this->relationLoaded('reviews') ? $this->reviews : collect();

        // For a product that sells by combination the parent row is not the
        // commercial unit: its stock is meaningless and its price is at best
        // the cheapest variant. Everything below reads the combinations.
        $variants = VariantSummary::fromRelation($this->resource);

        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'image'       => $images[0] ?? null,
            'images'      => $images,
            'price'       => $variants->hasVariants
                ? Money::payload($variants->priceFrom, null)
                : Money::payload(
                    $this->resource->inBaseCurrency((float) $this->new_price),
                    $this->old_price !== null ? $this->resource->inBaseCurrency((float) $this->old_price) : null,
                ),

            // ---- the seller's own figure, unconverted ----
            //
            // `price` above is what a shopper reads: converted to whatever
            // currency they asked for. This is what the seller typed, in the
            // currency they typed it in, and it is what their edit form has to
            // be filled with. Seeding that form from the display price would
            // have a seller who quoted $20 open the page while browsing in
            // shillings, see 50,000, and save it as their new base price.
            'base_price' => [
                'amount'   => (float) $this->new_price,
                'was'      => $this->old_price !== null ? (float) $this->old_price : null,
                'currency' => $this->base_currency ?? 'TZS',
            ],
            'stock'       => $variants->hasVariants ? $variants->stock : (int) $this->stock,
            'in_stock'    => $variants->hasVariants ? $variants->inStock() : $this->stock > 0,

            /**
             * How this product is priced and counted, when it sells by option.
             *
             * `price_from`/`price_to` are the range across live combinations,
             * so the page can lead with "From TZS 1,850,000" instead of
             * quoting one figure as though the choice did not change it.
             * `requires_selection` is what stops the page offering an Add to
             * cart before the shopper has said which one they want.
             */
            'variant_summary' => $variants->hasVariants ? [
                'has_variants'       => true,
                'requires_selection' => true,
                'stock'              => $variants->stock,
                'in_stock'           => $variants->inStock(),
                'price_from'         => $variants->priceFrom,
                'price_to'           => $variants->priceTo,
                'is_range'           => $variants->isRange(),
            ] : null,

            // Origin, transit mode and the promised window. The product page
            // leads with this, so it is a first-class part of the payload
            // rather than something the client has to infer.
            'sourcing'    => Sourcing::payload(
                $this->availability,
                $this->source_country,
                $this->lead_time_min_days,
                $this->lead_time_max_days,
                $this->shipping_method,
                $this->fulfilment_location,
            ),

            'category' => $this->category ? [
                'id' => $this->category->id, 'name' => $this->category->name,
            ] : null,
            'subcategory' => $this->subcategory ? [
                'id' => $this->subcategory->id, 'name' => $this->subcategory->name,
            ] : null,

            // Contact details are normalised here so the frontend never has
            // to guess whether a stored number is dialable. A seller whose
            // number is unusable simply reports null and the action is hidden
            // rather than published as a dead link.
            'vendor' => $this->vendor ? [
                'id'            => $this->vendor->id,
                'name'          => $this->vendor->business_name,
                'logo'          => Media::url($this->vendor->logo),
                'phone'         => Phone::e164($this->vendor->phone),
                'phone_display' => Phone::pretty($this->vendor->phone),
                'whatsapp'      => Phone::whatsapp($this->vendor->phone),
                'location'      => $this->vendor->business_address ?: null,
                'website'       => $this->vendor->website ?: null,
                'about'         => $this->vendor->description ?: null,
                // The badge tracks admin verification only. Approval merely
                // lets a seller trade; it is not a statement about the business.
                'is_approved'   => (bool) $this->vendor->is_approved,
                'is_verified'   => (bool) $this->vendor->is_verified,
                'member_since'  => optional($this->vendor->created_at)->format('Y'),
                // Lets the storefront open a chat without a second request.
                'user_id'       => $this->vendor->user_id ? (int) $this->vendor->user_id : null,
            ] : null,

            // Vendor-entered specs arrive from two places: the structured
            // attribute values and the free-form custom_fields JSON column.
            // Every way to buy this product, primary first. One entry means
            // the page renders a single price; two or more turn it into the
            // local-vs-imported comparison.
            'buying_options' => $this->buyingOptions(),

            // Optional quantity breaks. An empty array is the normal case and
            // means the price above applies at every quantity.
            'price_tiers' => $this->priceTierPayload(),

            // Optional selectable options. `axes` is the selector — one entry
            // per attribute, with the values that actually have a variant
            // behind them — and `variants` is what each combination costs and
            // how many are left. Both empty for an ordinary product.
            'options'  => $this->optionAxes(),
            'variants' => $this->variantPayload(),

            'specifications' => $this->specifications(),

            'rating' => [
                'average'      => round((float) ($reviews->avg('rating') ?? 0), 1),
                'count'        => $reviews->count(),
                'distribution' => $this->distribution($reviews),
            ],

            'reviews' => $reviews->map(fn ($review) => [
                'id'      => $review->id,
                'author'  => $review->user->name ?? 'Shopper',
                'rating'  => (int) $review->rating,
                'comment' => $review->comment,
                'date'    => optional($review->created_at)->format('Y-m-d'),
            ])->values(),
        ];
    }

    /**
     * The product's own row is always the first option; alternatives come
     * from `product_offers`. Sold-out imports are still offered — an import
     * is sourced on demand — while sold-out local stock is not.
     */
    private function buyingOptions(): array
    {
        // When the product sells by combination this row describes the
        // combinations, not the parent: quoting the parent's zero stock here
        // is what made a fully stocked iPhone read as unavailable.
        $variants = VariantSummary::fromRelation($this->resource);

        $primary = [
            'id'       => null,
            'price'    => $variants->hasVariants
                ? Money::payload($variants->priceFrom, null)
                : Money::payload(
                    $this->resource->inBaseCurrency((float) $this->new_price),
                    $this->old_price !== null ? $this->resource->inBaseCurrency((float) $this->old_price) : null,
                ),
            'stock'    => $variants->hasVariants ? $variants->stock : (int) $this->stock,
            'in_stock' => $variants->hasVariants
                ? $variants->inStock()
                : ($this->availability === Sourcing::IMPORT ? true : $this->stock > 0),
            'seller'   => $this->vendor->business_name ?? '2KONECT',
            'sourcing' => Sourcing::payload(
                $this->availability,
                $this->source_country,
                $this->lead_time_min_days,
                $this->lead_time_max_days,
                $this->shipping_method,
                $this->fulfilment_location,
            ),
        ];

        $alternatives = $this->relationLoaded('offers')
            ? $this->offers->where('is_active', true)->map(fn ($offer) => $offer->payload())->values()->all()
            : [];

        return array_merge([$primary], $alternatives);
    }

    /**
     * Quantity breaks, cheapest quantity first.
     *
     * Only meaningful against the product's own price, so a product whose
     * price is set per variant reports none — see App\Support\Pricing.
     */
    private function priceTierPayload(): array
    {
        if (! $this->relationLoaded('priceTiers')) {
            return [];
        }

        return $this->priceTiers
            ->sortBy('min_quantity')
            ->map(fn ($tier) => $tier->payload($this->base_currency))
            ->values()
            ->all();
    }

    /**
     * The selector: every option axis this product varies on, and the values
     * on each that at least one live variant actually offers.
     *
     * Built from the variants rather than from the category's attribute list,
     * so a colour nobody stocks never appears as a choice that cannot be
     * bought. Names come from the existing `attributes` and `attribute_values`
     * tables.
     */
    private function optionAxes(): array
    {
        if (! $this->relationLoaded('variants')) {
            return [];
        }

        $axes = [];

        foreach ($this->variants->where('is_active', true) as $variant) {
            foreach ($variant->options as $option) {
                $attribute = $option->attribute;
                $value     = $option->attributeValue;

                if (! $attribute || ! $value) {
                    continue;
                }

                $axisId = (int) $attribute->id;

                $axes[$axisId] ??= [
                    'attribute_id' => $axisId,
                    'name'         => $attribute->name,
                    'unit'         => $attribute->unit ?: null,
                    'sort_order'   => (int) ($attribute->sort_order ?? 0),
                    'values'       => [],
                ];

                $axes[$axisId]['values'][(int) $value->id] = [
                    'id'         => (int) $value->id,
                    'value'      => $value->value,
                    'sort_order' => (int) ($value->sort_order ?? 0),
                ];
            }
        }

        $axes = array_values($axes);
        usort($axes, fn ($a, $b) => [$a['sort_order'], $a['name']] <=> [$b['sort_order'], $b['name']]);

        foreach ($axes as &$axis) {
            $values = array_values($axis['values']);
            usort($values, fn ($a, $b) => [$a['sort_order'], $a['value']] <=> [$b['sort_order'], $b['value']]);
            $axis['values'] = $values;
            unset($axis['sort_order']);
        }

        return $axes;
    }

    private function variantPayload(): array
    {
        if (! $this->relationLoaded('variants')) {
            return [];
        }

        return $this->variants
            ->where('is_active', true)
            ->map(fn ($variant) => $variant->payload($this->resource))
            ->values()
            ->all();
    }

    /** @return array<int, array{label: string, value: string}> */
    private function specifications(): array
    {
        $specs = [];

        if ($this->relationLoaded('attributeValues')) {
            foreach ($this->attributeValues as $value) {
                if ($value->attribute) {
                    $specs[] = [
                        'label' => $value->attribute->name,
                        'value' => (string) $value->value,
                    ];
                }
            }
        }

        foreach ((array) ($this->custom_fields ?? []) as $label => $value) {
            if (is_scalar($value) && trim((string) $value) !== '') {
                $specs[] = ['label' => (string) $label, 'value' => (string) $value];
            }
        }

        return $specs;
    }

    /** Star breakdown (5 → 1) as percentages, for the reviews summary bars. */
    private function distribution($reviews): array
    {
        $total = $reviews->count();
        $out   = [];

        foreach ([5, 4, 3, 2, 1] as $star) {
            $count = $reviews->where('rating', $star)->count();
            $out[] = [
                'star'    => $star,
                'count'   => $count,
                'percent' => $total > 0 ? (int) round(($count / $total) * 100) : 0,
            ];
        }

        return $out;
    }
}
