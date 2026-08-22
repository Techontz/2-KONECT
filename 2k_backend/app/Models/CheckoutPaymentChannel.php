<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A way a customer can pay 2KONECT at checkout.
 *
 * Not to be confused with {@see PaymentMethod}, which is how a *vendor* gets
 * paid out.
 */
class CheckoutPaymentChannel extends Model
{
    /** Pay the marketplace's till number by hand, then send the reference. */
    public const LIPA_NAMBA = 'lipa_namba';

    /** Mobile money. Present as a channel so it can be switched on when an
        integration exists; never enabled by pretending one does. */
    public const MOBILE_MONEY = 'mobile_money';

    /** Cash on delivery. Not a row here — it takes no configuration and it is
        never available for an imported order. */
    public const CASH_ON_DELIVERY = 'cash_on_delivery';

    protected $fillable = [
        'code',
        'label',
        'merchant_name',
        'number',
        'instructions',
        'is_active',
        'requires_reference',
        'requires_verification',
        'sort_order',
    ];

    protected $casts = [
        'is_active'             => 'boolean',
        'requires_reference'    => 'boolean',
        'requires_verification' => 'boolean',
        'sort_order'            => 'integer',
    ];

    /** Channels a shopper may actually choose, cheapest ordering first. */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * What the storefront is told about this channel.
     *
     * Everything here is meant to be read by the customer — the till number is
     * the whole point. Nothing else on the row is exposed.
     */
    public function toStorefront(): array
    {
        return [
            'code'                  => $this->code,
            'label'                 => $this->label,
            'merchant_name'         => $this->merchant_name,
            'number'                => $this->number,
            'instructions'          => $this->instructions,
            'requires_reference'    => $this->requires_reference,
            'requires_verification' => $this->requires_verification,
        ];
    }
}
