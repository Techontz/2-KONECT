<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One buyable combination of option values.
 *
 * `price` null inherits the product's price — see `unitPrice()` — so a
 * product whose sizes all cost the same does not restate the figure per row.
 */
class ProductVariant extends Model
{
    protected $fillable = ['product_id', 'sku', 'price', 'stock', 'is_active'];

    protected $casts = [
        'price'     => 'decimal:2',
        'stock'     => 'integer',
        'is_active' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function options()
    {
        return $this->hasMany(ProductVariantOption::class);
    }

    /** What one unit of this variant costs before any quantity break. */
    public function unitPrice(Product $product): float
    {
        return (float) ($this->price ?? $product->new_price);
    }

    /**
     * `{attribute_id => attribute_value_id}` — the combination, in the form
     * the selector matches against.
     *
     * @return array<int, int>
     */
    public function combination(): array
    {
        return $this->options
            ->mapWithKeys(fn ($o) => [(int) $o->attribute_id => (int) $o->attribute_value_id])
            ->all();
    }

    /**
     * The chosen options in words: `[{attribute, value}, …]`.
     *
     * Copied onto the order at checkout so the line stays readable after the
     * listing is edited or the variant deleted.
     *
     * @return array<int, array{attribute: string, value: string}>
     */
    public function optionSnapshot(): array
    {
        return $this->options
            ->map(fn ($option) => [
                'attribute' => $option->attribute->name ?? '',
                'value'     => $option->attributeValue->value ?? '',
            ])
            ->filter(fn ($row) => $row['attribute'] !== '' && $row['value'] !== '')
            ->values()
            ->all();
    }

    public function payload(Product $product): array
    {
        return [
            'id'       => $this->id,
            'sku'      => $this->sku,
            'price'    => \App\Support\Money::payload(
                \App\Support\Currency::toBase($this->unitPrice($product), $product->base_currency),
                null,
            ),
            'stock'    => (int) $this->stock,
            'in_stock' => $this->stock > 0,
            'options'  => $this->options->map(fn ($o) => [
                'attribute_id'       => (int) $o->attribute_id,
                'attribute_value_id' => (int) $o->attribute_value_id,
            ])->values()->all(),
        ];
    }
}
