<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Helpers\FileHelper;

class Subcategory extends Model
{
    protected $fillable = [
        'name',
        'icon',
        'category_id',
        'icon_image',
    ];

    protected $appends = ['icon_image_url'];

    /**
     * Auto-copy uploaded files to public/storage when saved.
     */
    protected static function booted()
    {
        static::saved(function ($subcategory) {
            if ($subcategory->icon_image) {
                FileHelper::copyToPublicStorage($subcategory->icon_image);
            }
        });
    }

    /**
     * Relationship: Subcategory belongs to Category
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Relationship: Subcategory has many Products
     */
    public function products()
    {
        return $this->hasMany(\App\Models\Product::class, 'subcategory_id');
    }

    /**
     * Accessor: Get full URL for icon_image
     */
    public function getIconImageUrlAttribute()
    {
        return $this->icon_image
            ? asset('storage/' . $this->icon_image)
            : null;
    }
}
