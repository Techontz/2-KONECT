<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CategoryField extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'name', // E.g. "Color", "Size", etc
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
