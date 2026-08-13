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
    ];

    protected $casts = [
        'price'        => 'decimal:2',
        'total'        => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'quantity'     => 'integer',
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
}
