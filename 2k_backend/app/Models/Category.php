<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Category extends Model
{
    use HasFactory;

    // Add 'icon_image' to fillable so it can be mass assigned
    protected $fillable = [
        'name',
        'icon',        // Emoji or icon class name
        'icon_image',  // Filename or path to uploaded icon image
    ];

    public function fields()
    {
        return $this->hasMany(CategoryField::class);
    }

    public function attributes()
    {
        return $this->hasMany(Attribute::class);
    }
    
    public function subcategories()
    {
        return $this->hasMany(Subcategory::class);
    }

    /**
     * Products filed directly under this category. Storefront listings count
     * and shelve by this, so it needs to be a first-class relation rather than
     * a hop through subcategories (many products have no subcategory).
     */
    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
