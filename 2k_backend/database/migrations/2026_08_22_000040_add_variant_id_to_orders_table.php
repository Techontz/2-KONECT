<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records which variant an order line was for.
 *
 * Nullable, with no default, so every one of the 109 existing orders keeps
 * exactly the value it has now — null, meaning "the product itself", which is
 * what those orders were. No existing row is rewritten.
 *
 * The column matters because a variant's price and stock can be edited later;
 * the order has to remember what was actually bought, the same reason the
 * sourcing promise is already copied onto the order at checkout.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('product_variant_id')->nullable()->after('offer_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_variant_id');
        });
    }
};
