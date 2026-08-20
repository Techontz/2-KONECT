<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductImage extends Model
{
    use HasFactory;

    protected $fillable = ['product_id', 'image'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    // Accessor for image URL
    public function getUrlAttribute()
    {
        // Handles images stored as "products/xyz.jpg"
        return asset('storage/' . $this->image);
    }
}
