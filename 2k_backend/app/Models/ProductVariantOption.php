<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A variant's choice on one option axis.
 *
 * Both foreign keys point into the attribute vocabulary that already existed:
 * `attributes` for the axis, `attribute_values` for the choice.
 */
class ProductVariantOption extends Model
{
    protected $fillable = ['product_variant_id', 'attribute_id', 'attribute_value_id'];

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function attribute()
    {
        return $this->belongsTo(Attribute::class);
    }

    public function attributeValue()
    {
        return $this->belongsTo(AttributeValue::class);
    }
}
