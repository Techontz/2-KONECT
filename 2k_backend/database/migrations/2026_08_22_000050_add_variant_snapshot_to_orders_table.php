<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the buyer actually chose, in words, frozen at checkout.
 *
 * `product_variant_id` says which row was bought, but a row can be renamed,
 * repriced or deleted, and its option values can be edited from under it. An
 * order that can only be read by looking up today's configuration is an order
 * that becomes wrong the first time the seller edits the listing.
 *
 * So the labels are copied in — `[{"attribute":"COLOR","value":"Blue"}, …]` —
 * for the same reason the sourcing promise and the unit price are already
 * copied onto the order rather than re-derived.
 *
 * Nullable, no default: every existing order keeps null, meaning "no options
 * were chosen", which is exactly what all 109 of them were.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->json('variant_options')->nullable()->after('product_variant_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('variant_options');
        });
    }
};
