<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The currency a seller actually typed their price in.
 *
 * Every price in this database is Tanzanian Shillings and always has been, so
 * the default backfills every existing row correctly and no data is touched.
 * What changes is that a price is no longer *implicitly* TZS: from here it
 * says so, which is what lets a seller quote in dollars without their figure
 * being converted and overwritten.
 *
 * The stored price remains the seller's own number. Nothing converts it on the
 * way in. Conversion happens when a price is shown, against the rate the
 * administrator set, and the original is what the order is priced from.
 *
 * Purely additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'base_currency')) {
                $table->string('base_currency', 3)->default('TZS')->after('new_price');
            }
        });

        // Offers and variants are alternative prices for the same listing, so
        // they are quoted in the listing's currency rather than each carrying
        // their own. A seller who sells one product in dollars sells all of its
        // options in dollars.
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'base_currency')) {
                $table->dropColumn('base_currency');
            }
        });
    }
};
