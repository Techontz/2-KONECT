<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How a customer pays 2KONECT at checkout, configured by an administrator.
 *
 * Deliberately not `payment_methods`. That table already exists and means
 * something else entirely — it is the list of ways a *vendor* is paid out
 * (M-Pesa, CRDB, NMB…) and is joined to `vendor_payment_options`. Overloading
 * it would put a seller's payout account and the marketplace's own till number
 * in one list, which is how a payout ends up offered as a checkout option.
 *
 * One row per channel, so mobile money can be added later without touching any
 * of the code that reads this — the checkout renders whatever is active, and
 * the order stores the channel's `code` in the `payment_method` column it
 * already has.
 *
 * The till number lives here rather than in the storefront bundle. It is not a
 * secret, but it is an operational detail that changes without a deployment,
 * and a number baked into JavaScript is a number that is wrong the day it
 * changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checkout_payment_channels', function (Blueprint $table) {
            $table->id();

            // Matches what is written to `orders.payment_method`.
            $table->string('code', 40)->unique();

            // What the shopper is shown.
            $table->string('label', 80);
            $table->string('merchant_name', 120)->nullable();

            // The till / paybill number. Nullable because a channel that is
            // only an integration (a gateway) has no number to display.
            $table->string('number', 60)->nullable();

            $table->text('instructions')->nullable();

            // Off by default: a channel is never live until somebody has
            // filled in the number and deliberately switched it on.
            $table->boolean('is_active')->default(false);

            // Whether the shopper has to send us a transaction reference, and
            // whether an administrator must confirm it before the order counts
            // as paid. Both true for a till number paid by hand; both false
            // for a gateway that confirms itself.
            $table->boolean('requires_reference')->default(true);
            $table->boolean('requires_verification')->default(true);

            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkout_payment_channels');
    }
};
