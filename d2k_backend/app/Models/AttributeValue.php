<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One allowed option for an attribute, e.g. "XL" under Size. */
class AttributeValue extends Model
{
    protected $fillable = ['attribute_id', 'value', 'sort_order'];

    public function attribute()
    {
        return $this->belongsTo(Attribute::class);
    }
}
