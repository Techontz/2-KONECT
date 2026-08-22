<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optional quantity-break pricing.
 *
 * A product with no rows here behaves exactly as it always has: one price,
 * `products.new_price`, whatever the quantity. Nothing about an existing
 * listing changes, and no existing row is written.
 *
 * `max_quantity` null means "and upwards" — the open-ended top tier.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_price_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('min_quantity');
            $table->unsignedInteger('max_quantity')->nullable();
            $table->decimal('unit_price', 12, 2);
            $table->timestamps();

            // Every read is "the tiers for this product, cheapest quantity
            // first", so the index carries the ordering too.
            $table->index(['product_id', 'min_quantity'], 'product_price_tiers_lookup_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_tiers');
    }
};
