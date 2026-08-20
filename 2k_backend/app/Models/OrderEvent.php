<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One recorded step in an order's journey.
 *
 * Events attach to the checkout reference rather than to a single line: a
 * basket can span several vendors, but the buyer is tracking one delivery.
 */
class OrderEvent extends Model
{
    protected $fillable = [
        'reference', 'order_id', 'status', 'title', 'note', 'location', 'happened_at',
    ];

    protected $casts = [
        'happened_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
