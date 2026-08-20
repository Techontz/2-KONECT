<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A shopper asking 2KONECT to source something the catalogue does not carry.
 */
class ProductRequest extends Model
{
    /** The ladder a request climbs, in order. */
    public const STATUSES = [
        'submitted', 'reviewing', 'sourcing', 'quoted', 'confirmed',
        'ordered', 'in_transit', 'arrived', 'completed', 'unavailable', 'cancelled',
    ];

    protected $fillable = [
        'reference', 'user_id', 'name', 'description', 'brand', 'quantity',
        'budget_max', 'image', 'contact_name', 'contact_phone', 'contact_email',
        'delivery_city', 'status', 'quoted_price', 'quoted_eta_min_days',
        'quoted_eta_max_days', 'quoted_at', 'admin_note',
    ];

    protected $casts = [
        'quantity'     => 'integer',
        'budget_max'   => 'decimal:2',
        'quoted_price' => 'decimal:2',
        'quoted_at'    => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
