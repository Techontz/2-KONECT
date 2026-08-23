<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Model;

/**
 * One attempt to pay for a checkout.
 *
 * A row here is a record of what a gateway was asked to do and what it said.
 * It is never the authority on whether an order is settled — `orders
 * .payment_status` is, and only a verified webhook may move it.
 */
class Payment extends Model
{
    public const STRIPE = 'stripe';

    /* Payment states, deliberately the gateway's vocabulary rather than the
       order's, so the two are never confused for each other. */
    public const PENDING   = 'pending';
    public const PAID      = 'paid';
    public const FAILED    = 'failed';
    public const EXPIRED   = 'expired';
    public const REFUNDED  = 'refunded';
    public const DISPUTED  = 'disputed';

    protected $fillable = [
        'reference', 'user_id', 'provider', 'status', 'currency', 'amount_minor',
        'stripe_session_id', 'stripe_payment_intent_id', 'stripe_charge_id',
        'failure_code', 'failure_message', 'refunded_amount_minor', 'raw', 'paid_at',
    ];

    protected $casts = [
        'raw'                   => 'array',
        'amount_minor'          => 'integer',
        'refunded_amount_minor' => 'integer',
        'paid_at'               => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** The order lines this payment covers. */
    public function orders()
    {
        return $this->hasMany(Order::class, 'reference', 'reference');
    }

    /** The amount as a human reads it, never recomputed by hand. */
    public function amount(): float
    {
        return Money::fromMinorUnits((int) $this->amount_minor, (string) $this->currency);
    }

    public function refundedAmount(): float
    {
        return Money::fromMinorUnits((int) $this->refunded_amount_minor, (string) $this->currency);
    }

    /**
     * Keys stripped from a stored gateway object.
     *
     * A Checkout Session carries the shopper's email, name and address, and a
     * charge carries card details. None of it is needed to reconcile a payment,
     * and this table is read by anybody with admin access and kept for years.
     */
    public const REDACTED = [
        'customer_details', 'customer_email', 'billing_details', 'shipping_details',
        'receipt_email', 'payment_method_details', 'source', 'payment_method',
    ];

    /** @param array<string,mixed> $payload */
    public static function redact(array $payload): array
    {
        foreach (self::REDACTED as $key) {
            if (array_key_exists($key, $payload)) {
                $payload[$key] = '[redacted]';
            }
        }

        return $payload;
    }
}
