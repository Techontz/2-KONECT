<?php

namespace App\Models;

use App\Support\Money;
use App\Support\Sourcing;
use Illuminate\Database\Eloquent\Model;

/**
 * An alternative way to buy a product — typically the imported one, cheaper
 * but slower, alongside the local stock the product row itself represents.
 */
class ProductOffer extends Model
{
    protected $fillable = [
        'product_id', 'vendor_id', 'availability', 'source_country', 'price',
        'was_price', 'stock', 'lead_time_min_days', 'lead_time_max_days',
        'shipping_method', 'fulfilment_location', 'is_active',
    ];

    protected $casts = [
        'price'     => 'decimal:2',
        'was_price' => 'decimal:2',
        'stock'     => 'integer',
        'is_active' => 'boolean',
        'lead_time_min_days' => 'integer',
        'lead_time_max_days' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * The shape the storefront's buying-options selector renders.
     *
     * Identical in structure to the primary offer built from the product row,
     * so the UI compares like with like instead of special-casing.
     */
    public function payload(?string $baseCurrency = null): array
    {
        // An offer is an alternative price for the same listing, so it is
        // quoted in the listing's currency — not assumed to be shillings.
        $currency = $baseCurrency ?? $this->product?->base_currency;

        return [
            'id'       => $this->id,
            'price'    => Money::payload(
                \App\Support\Currency::toBase((float) $this->price, $currency),
                $this->was_price !== null
                    ? \App\Support\Currency::toBase((float) $this->was_price, $currency)
                    : null,
            ),
            'stock'    => (int) $this->stock,
            // An import is ordered on demand, so it is buyable without local
            // stock; local stock is what it says it is.
            'in_stock' => $this->availability === Sourcing::IMPORT ? true : $this->stock > 0,
            'seller'   => $this->vendor?->business_name ?? '2KONECT',
            'sourcing' => Sourcing::payload(
                $this->availability,
                $this->source_country,
                $this->lead_time_min_days,
                $this->lead_time_max_days,
                $this->shipping_method,
                $this->fulfilment_location,
            ),
        ];
    }
}
