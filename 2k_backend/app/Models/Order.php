<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Support\OrderGate;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference',
        'user_id',
        'vendor_id',
        'product_id',
        // Which alternative offer, and which option combination, this line was
        // for. `offer_id` was missing from this list while OrderController
        // passed it to Order::create(), so mass assignment silently dropped it
        // and no order has ever recorded one -- 109 of them, all null, against
        // 582 live offers. Nothing drifted, because every one of those offers
        // is an import and imports neither reserve nor restore stock, but a
        // seller listing a local alternative would have had cancellations
        // credit the product instead of the offer. Variants do count stock, so
        // they must be here from the start.
        'offer_id',
        'product_variant_id',
        // The chosen options in words, frozen at checkout so the order stays
        // readable after the listing is edited.
        'variant_options',
        'quantity',
        'price',
        'total',
        'delivery_fee',
        'status',
        'payment_provider',
        'payment_method',
        // Whether the money actually arrived, as opposed to which method was
        // chosen. Prepaid orders are worthless without this: the reference is
        // a claim until an administrator confirms it.
        'payment_status',
        'payment_reference',
        'payment_submitted_at',
        'payment_verified_at',
        'payment_verified_by',
        'payment_note',
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
    
        'display_currency',
        'charge_currency',
        'exchange_rate',
    ];

    protected $casts = [
        'payment_submitted_at' => 'datetime',
        'payment_verified_at'  => 'datetime',
        'variant_options' => 'array',
        'price'        => 'decimal:2',
        'total'        => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'quantity'     => 'integer',
        'eta_min_days' => 'integer',
        'eta_max_days' => 'integer',
        'estimated_arrival_at' => 'date',
    
        'exchange_rate' => 'decimal:6',];

    /**
     * The last line of defence for the prepayment rule.
     *
     * Every controller that can advance an order asks {@see OrderGate} first,
     * and every one of them answers politely when the answer is no. This is
     * for the paths that do not go through a controller at all — the Filament
     * edit form, whose status select offers every stop on the journey; a
     * console command; a tinker session; the next endpoint somebody writes.
     *
     * An unpaid import may still be created, may stay `pending`, and may be
     * cancelled or refunded. It may not be moved forward. Enforced here
     * because a rule that only exists in controllers is a rule that lasts
     * until the next surface is added.
     *
     * Query-builder updates bypass model events, so this is a backstop and not
     * the whole enforcement — which is why the controllers check too.
     */
    protected static function booted(): void
    {
        static::saving(function (self $order) {
            if (! $order->isDirty('status')) {
                return;
            }

            // Closing an order is always allowed: cancelling returns reserved
            // stock, and a refund is a record of money going back.
            if (in_array($order->status, ['pending', 'cancelled', 'refunded'], true)) {
                return;
            }

            if (OrderGate::awaitsPrepayment($order)) {
                throw ValidationException::withMessages(['status' => OrderGate::MESSAGE]);
            }
        });
    }

    public function buyer()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function variant()
    {
        return $this->belongsTo(\App\Models\ProductVariant::class, 'product_variant_id');
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
