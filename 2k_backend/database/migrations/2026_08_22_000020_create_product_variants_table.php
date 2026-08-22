<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Selectable product variants — one row per buyable combination.
 *
 * Deliberately built on top of the attribute vocabulary that already exists
 * rather than beside it. `attributes` and `attribute_values` already hold
 * Colour, Size, Storage and their curated options, scoped per category; a
 * variant simply names which of those values it is, through the pivot in the
 * next migration. Nothing here re-declares an option system.
 *
 * What this adds that `product_attribute_values` genuinely could not: stock,
 * price and a SKU per *combination*. That table stores a single scalar value
 * per product per attribute, so it can say "Material: Cotton" but never
 * "Black + 128GB has eight left at 850,000".
 *
 * `price` null means the variant inherits the product's price, so a size-only
 * product does not have to restate the same figure on every row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 64)->nullable();
            $table->decimal('price', 12, 2)->nullable();
            $table->unsignedInteger('stock')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['product_id', 'is_active'], 'product_variants_lookup_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
