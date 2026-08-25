<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One payment notification, as received from a gateway.
 *
 * A row here is evidence that something was *claimed*, never evidence that
 * money arrived. See {@see \App\Services\AzamPay\CallbackProcessor} for why
 * that distinction is load-bearing rather than pedantic.
 */
class PaymentCallback extends Model
{
    public const AZAMPAY = 'azampay';

    protected $fillable = [
        'provider',
        'external_id',
        'provider_reference',
        'status',
        'amount',
        'currency',
        'payload',
        'processed_at',
    ];

    protected $casts = [
        'payload'      => 'array',
        'amount'       => 'decimal:2',
        'processed_at' => 'datetime',
    ];

    /**
     * The fields never written to this table.
     *
     * `msisdn` is the payer's phone number and `submerchantAcc` is an account
     * identifier; neither is needed to reconcile a payment against a statement,
     * and a callback body is stored for a long time and read by a lot of
     * people. Everything else is kept verbatim, because the point of keeping it
     * is to see exactly what was sent.
     */
    public const REDACTED = ['msisdn', 'submerchantAcc'];

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
