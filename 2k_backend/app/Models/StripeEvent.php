<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A Stripe webhook event, recorded exactly once.
 *
 * The primary key is Stripe's own `evt_…` id, which is the whole idempotency
 * guarantee: a redelivery cannot insert, so it cannot process. Stripe retries
 * anything that does not answer 2xx, so this is not a nicety.
 */
class StripeEvent extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'type', 'payload', 'processed_at', 'error'];

    protected $casts = [
        'payload'      => 'array',
        'processed_at' => 'datetime',
    ];

    public function markProcessed(): void
    {
        $this->update(['processed_at' => now(), 'error' => null]);
    }

    public function markFailed(string $error): void
    {
        // Truncated: an exception message can be enormous and this column is
        // for triage, not for a stack trace.
        $this->update(['error' => mb_substr($error, 0, 2000)]);
    }
}
