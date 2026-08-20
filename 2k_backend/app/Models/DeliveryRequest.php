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

    /** How this status reads to the person waiting for the package. */
    public function statusLabel(): string
    {
        return match ($this->status) {
            'requested'   => 'Requested',
            'scheduled'   => 'Scheduled',
            'in_progress' => 'On the way',
            'delivered'   => 'Delivered',
            'cancelled'   => 'Cancelled',
            default       => ucfirst(str_replace('_', ' ', $this->status)),
        };
    }

    /**
     * The shape every surface renders.
     *
     * Defined once: the order page and the deliveries list were building this
     * separately, and the order page's copy was missing `status_label`, so it
     * printed "2KONECT Rides · undefined" beside a real delivery.
     */
    public function payload(): array
    {
        return [
            'reference'        => $this->reference,
            'order_reference'  => $this->order_reference,
            'mode'             => $this->mode,
            'status'           => $this->status,
            'status_label'     => $this->statusLabel(),
            'recipient_name'   => $this->recipient_name,
            'recipient_phone'  => $this->recipient_phone,
            'address'          => $this->address,
            'pickup_point'     => $this->pickup_point,
            'preferred_date'   => $this->preferred_date?->toDateString(),
            'preferred_window' => $this->preferred_window,
            'fee'              => (float) $this->fee,
            'courier_name'     => $this->courier_name,
            'courier_phone'    => $this->courier_phone,
            'created_at'       => $this->created_at?->toIso8601String(),
        ];
    }
}
