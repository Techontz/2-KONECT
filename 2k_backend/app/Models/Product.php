<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'vendor_id',
        'category_id',
        'subcategory_id', // <--- ADD THIS!
        'name',
        'description',
        'old_price',
        'new_price',
        'stock',          // <--- ADD THIS!
        'image',
        'location',
        'custom_fields',
        'short_description',
        // Where the item is and how long it takes to arrive. See App\Support\Sourcing.
        'availability',
        'source_country',
        'lead_time_min_days',
        'lead_time_max_days',
        'shipping_method',
        'fulfilment_location',
    ];

    protected $casts = [
        'custom_fields'      => 'array',
        'lead_time_min_days' => 'integer',
        'lead_time_max_days' => 'integer',
    ];

    // Eager load all useful relationships
    protected $with = [
        'attributeValues.attribute',
        'images',
        'vendor',
        'category',
        'subcategory'
    ];

    // Relationship to vendor
    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    // Relationship to category
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    // Relationship to product attribute values
    public function attributeValues()
    {
        // The table is 'product_attribute_values'!
        return $this->hasMany(ProductAttributeValue::class);
    }

    // Relationship to product images
    public function images()
    {
        return $this->hasMany(ProductImage::class);
    }

    public function subcategory()
    {
        return $this->belongsTo(Subcategory::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }

    /** Alternative ways to buy this product — see ProductOffer. */
    public function offers()
    {
        return $this->hasMany(ProductOffer::class);
    }

    /**
     * Optional quantity breaks, cheapest quantity first.
     *
     * A product with none of these prices exactly as it always did.
     */
    public function priceTiers()
    {
        return $this->hasMany(ProductPriceTier::class)->orderBy('min_quantity');
    }

    /** Optional selectable combinations. Empty for an ordinary product. */
    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function hasBulkPricing(): bool
    {
        return $this->relationLoaded('priceTiers')
            ? $this->priceTiers->isNotEmpty()
            : $this->priceTiers()->exists();
    }

    /** Is this item already in the country, or does it have to be brought in? */
    public function isImport(): bool
    {
        return $this->availability === \App\Support\Sourcing::IMPORT;
    }

    /** The "where is it / when do I get it" block the storefront renders. */
    public function sourcing(): array
    {
        return \App\Support\Sourcing::payload(
            $this->availability,
            $this->source_country,
            $this->lead_time_min_days,
            $this->lead_time_max_days,
            $this->shipping_method,
            $this->fulfilment_location,
        );
    }

    /* ---------------- scopes ---------------- */

    public function scopeLocal($query)
    {
        return $query->where('availability', \App\Support\Sourcing::LOCAL);
    }

    public function scopeImported($query)
    {
        return $query->where('availability', \App\Support\Sourcing::IMPORT);
    }
}
