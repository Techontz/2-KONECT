<?php

namespace App\Http\Resources;

use App\Support\Media;
use App\Support\Phone;
use App\Support\Money;
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

        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'image'       => $images[0] ?? null,
            'images'      => $images,
            'price'       => Money::payload($this->new_price, $this->old_price),
            'stock'       => (int) $this->stock,
            'in_stock'    => $this->stock > 0,

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
