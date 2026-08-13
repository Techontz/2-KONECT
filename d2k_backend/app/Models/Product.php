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
    ];

    protected $casts = [
        'custom_fields' => 'array',
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

}
