<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a channel is a gateway that confirms itself.
 *
 * The distinction the storefront needs is not "which gateway" but "does the
 * shopper read a number off the screen, or get sent somewhere to pay". A
 * manual channel shows a till number and asks for a transaction reference
 * afterwards; a gateway shows a button and settles through a webhook.
 *
 * The original `checkout_payment_channels` migration anticipated this in
 * words — `requires_verification` was documented as "false for a gateway that
 * confirms itself" — but the clients could not tell the two apart from that
 * alone, and inferring it from `code === 'stripe'` would put the gateway list
 * back in the frontend where the till number used to be.
 *
 * Also seeds the Stripe row, **inactive**. It appears in the admin panel so it
 * can be switched on deliberately; until somebody does, no shopper is offered
 * it and `CheckoutPolicy::allowedMethods()` will not accept it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checkout_payment_channels', function (Blueprint $table) {
            if (! Schema::hasColumn('checkout_payment_channels', 'is_gateway')) {
                $table->boolean('is_gateway')->default(false)->after('is_active');
            }
        });

        // Existing channels are all paid by hand, which is what the default
        // already says. Named here so the intent is on the record.
        DB::table('checkout_payment_channels')->update(['is_gateway' => false]);

        if (! DB::table('checkout_payment_channels')->where('code', 'stripe')->exists()) {
            DB::table('checkout_payment_channels')->insert([
                'code'          => 'stripe',
                'label'         => 'Card payment',
                'merchant_name' => null,
                // A gateway has no till number to display.
                'number'        => null,
                'instructions'  => 'Pay securely by card. You will be taken to our payment provider and returned here afterwards.',

                // Off. Switching this on is a deliberate act in the admin
                // panel, and it is not the only switch — config('stripe.enabled')
                // decides whether the routes exist at all.
                'is_active'     => false,
                'is_gateway'    => true,

                // The gateway confirms itself through a signed webhook. There
                // is no reference for the shopper to type and no human
                // verification step, which is precisely why the webhook is the
                // only thing allowed to settle one of these orders.
                'requires_reference'    => false,
                'requires_verification' => false,

                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('checkout_payment_channels')->where('code', 'stripe')->delete();

        Schema::table('checkout_payment_channels', function (Blueprint $table) {
            if (Schema::hasColumn('checkout_payment_channels', 'is_gateway')) {
                $table->dropColumn('is_gateway');
            }
        });
    }
};
