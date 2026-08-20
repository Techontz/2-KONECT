<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendorPaymentOption extends Model
{
    protected $fillable = [
        'vendor_id',
        'payment_type_id',
        'payment_method_id',
        'account',
    ];

    // ✅ Relation for payment type
    public function paymentType()
    {
        return $this->belongsTo(PaymentType::class, 'payment_type_id');
    }

    // ✅ Relation for payment method
    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }
}
