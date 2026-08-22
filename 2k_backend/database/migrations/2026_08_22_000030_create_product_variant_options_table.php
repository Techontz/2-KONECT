<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which option values a variant is.
 *
 * Both columns point at the existing tables: `attributes` supplies the axis
 * (Colour, Storage) and `attribute_values` the choice on it (Black, 128GB).
 * A variant with two rows here is a two-axis combination.
 *
 * `attribute_id` is carried alongside `attribute_value_id` — strictly it is
 * derivable, but every read groups by axis to build the selector, and having
 * it here turns that into a plain column read instead of a join back through
 * attribute_values for each row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variant_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_value_id')->constrained('attribute_values')->cascadeOnDelete();
            $table->timestamps();

            // One value per axis per variant: "Black and also White" is not a
            // combination, it is two variants.
            $table->unique(['product_variant_id', 'attribute_id'], 'product_variant_options_axis_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_options');
    }
};
