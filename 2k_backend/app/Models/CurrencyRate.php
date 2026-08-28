<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One exchange rate, as it stood.
 *
 * Rows are never updated in place except to be deactivated, so the table is
 * simultaneously the current rate and the complete history of every rate the
 * marketplace has ever applied — including who set it and what it replaced.
 */
class CurrencyRate extends Model
{
    protected $fillable = [
        'base', 'quote', 'rate', 'is_active', 'changed_by', 'previous_rate', 'note',
    ];

    protected $casts = [
        'is_active'     => 'boolean',
        // Strings, not floats. A rate read back as a float and multiplied is
        // how a rounding error becomes a price.
        'rate'          => 'decimal:6',
        'previous_rate' => 'decimal:6',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
