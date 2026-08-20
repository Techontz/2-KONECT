<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference',
        'user_id',
        'vendor_id',
        'product_id',
        'quantity',
        'price',
        'total',
        'delivery_fee',
        'status',
        'payment_provider',
        'payment_method',
        'delivery_address',
        'customer_phone',
        'external_id',
        // Shipping half: how this line reaches the buyer, and by when.
        'fulfilment_type',
        'source_country',
        'shipping_method',
        'eta_min_days',
        'eta_max_days',
        'estimated_arrival_at',
        'tracking_number',
        'carrier',
    ];

    protected $casts = [
        'price'        => 'decimal:2',
        'total'        => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'quantity'     => 'integer',
        'eta_min_days' => 'integer',
        'eta_max_days' => 'integer',
        'estimated_arrival_at' => 'date',
    ];

    public function buyer()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The recorded journey for the checkout this line belongs to.
     *
     * Keyed on `reference` rather than `order_id`: a basket spanning three
     * vendors is three rows here but one delivery to the buyer.
     */
    public function events()
    {
        return $this->hasMany(OrderEvent::class, 'reference', 'reference')
            ->orderBy('happened_at');
    }

    public function isImport(): bool
    {
        return $this->fulfilment_type === \App\Support\Sourcing::IMPORT;
    }
}
