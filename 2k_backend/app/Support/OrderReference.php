<?php

namespace App\Support;

use App\Models\Order;
use Illuminate\Support\Str;

/**
 * The human-quotable order number shared by every line of one checkout.
 *
 * Extracted so that every path which creates orders produces the same thing.
 * It used to live privately inside the storefront checkout, while the legacy
 * checkout took the reference *from the request body* and defaulted it to the
 * literal string "ManualConfirm" when none was sent.
 *
 * That was not a cosmetic difference. `orders.reference` is what groups a
 * checkout together, and settlement is applied to a whole group at once — so
 * every order that ever went through the legacy route without a reference
 * joined one shared, cross-account group. Verifying any one of them would have
 * settled all of them, for every customer in it. A reference is an identity,
 * and identities are never accepted from the caller.
 */
class OrderReference
{
    /** Format: `2K-` + 8 uppercase alphanumerics. */
    public static function generate(): string
    {
        do {
            $reference = '2K-' . strtoupper(Str::random(8));
        } while (Order::where('reference', $reference)->exists());

        return $reference;
    }
}
