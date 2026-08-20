<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A last-mile job: the buyer asking for a landed order to be brought to them,
 * or reserving it for collection. The foundation of 2KONECT Rides.
 */
class DeliveryRequest extends Model
{
    public const STATUSES = ['requested', 'scheduled', 'in_progress', 'delivered', 'cancelled'];

    protected $fillable = [
        'reference', 'user_id', 'order_reference', 'mode', 'recipient_name',
        'recipient_phone', 'address', 'city', 'latitude', 'longitude',
        'pickup_point', 'preferred_date', 'preferred_window', 'notes', 'fee',
        'status', 'courier_name', 'courier_phone', 'completed_at',
    ];

    protected $casts = [
        'latitude'       => 'float',
        'longitude'      => 'float',
        'fee'            => 'decimal:2',
        'preferred_date' => 'date',
        'completed_at'   => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
