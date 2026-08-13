<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Address extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'full_name', 'phone', 'region', 'city',
        'district', 'street', 'details', 'latitude', 'longitude', 'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'latitude'   => 'float',
        'longitude'  => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The address as a courier would read it, thinnest detail first.
     *
     * Built here rather than in the frontend so the website, the Flutter app
     * and the order record all print the same thing.
     */
    public function getFormattedAttribute(): string
    {
        $parts = array_filter([
            $this->street,
            $this->details,
            $this->district,
            $this->city,
            $this->region,
        ], fn ($part) => trim((string) $part) !== '');

        return implode(', ', $parts);
    }
}
