<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One quantity break on a product.
 *
 * `max_quantity` null is the open-ended top tier: "1,001 and up".
 */
class ProductPriceTier extends Model
{
    protected $fillable = ['product_id', 'min_quantity', 'max_quantity', 'unit_price'];

    protected $casts = [
        'min_quantity' => 'integer',
        'max_quantity' => 'integer',
        'unit_price'   => 'decimal:2',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /** Does this tier cover `$quantity` units? */
    public function covers(int $quantity): bool
    {
        if ($quantity < $this->min_quantity) {
            return false;
        }

        return $this->max_quantity === null || $quantity <= $this->max_quantity;
    }

    /**
     * @param  string|null  $baseCurrency  The listing's own currency. Tiers are
     *         quoted in it, like every other price on the product.
     */
    public function payload(?string $baseCurrency = null): array
    {
        // Converted the same way a listing price is: out of the seller's
        // currency into canonical shillings, then into whatever the shopper
        // asked for. This used to return the stored number raw, so a bulk
        // table read "$50,000" to anybody browsing in dollars.
        $canonical = \App\Support\Currency::toBase((float) $this->unit_price, $baseCurrency);

        return [
            'min_quantity' => (int) $this->min_quantity,
            'max_quantity' => $this->max_quantity !== null ? (int) $this->max_quantity : null,
            'unit_price'   => \App\Support\Currency::fromBase($canonical, \App\Support\Money::displayCurrency()),
            // The canonical figure travels with it, for anything comparing
            // rather than printing.
            'unit_price_base' => $canonical,
            // Rendered as "1–4" or "1,001+", so the label is built once here
            // rather than in each of the places that shows the table.
            'label'        => $this->max_quantity === null
                ? number_format((int) $this->min_quantity) . '+'
                : number_format((int) $this->min_quantity) . '–' . number_format((int) $this->max_quantity),
        ];
    }
}
