<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The shopper's Stripe customer, once they have one.
 *
 * Nullable and unused until a payment is actually made. Reusing a customer
 * across orders is what lets Stripe show a coherent history in the Dashboard
 * and lets a returning shopper see a saved card, rather than appearing as a
 * new stranger on every purchase.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'stripe_customer_id')) {
                $table->string('stripe_customer_id', 255)->nullable()->after('firebase_uid')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'stripe_customer_id')) {
                $table->dropColumn('stripe_customer_id');
            }
        });
    }
};
