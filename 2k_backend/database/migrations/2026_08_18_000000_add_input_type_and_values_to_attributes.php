<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Let administrators define controlled attribute options.
 *
 * `attributes` already existed and is already category-scoped, so it is
 * extended rather than replaced. What was missing is the shape of the input
 * and the list of allowed values — without them every seller retypes "Black",
 * "black" and "BLACK", and the catalogue cannot be filtered on colour.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('attributes') && ! Schema::hasColumn('attributes', 'input_type')) {
            Schema::table('attributes', function (Blueprint $table) {
                // select | multiselect | text | number
                $table->string('input_type', 20)->default('text')->after('name');
                $table->string('unit', 20)->nullable()->after('input_type');
                $table->boolean('is_active')->default(true)->after('unit');
                $table->unsignedInteger('sort_order')->default(0)->after('is_active');
            });
        }

        if (! Schema::hasTable('attribute_values')) {
            Schema::create('attribute_values', function (Blueprint $table) {
                $table->id();
                $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
                $table->string('value');
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                // The same option cannot be listed twice under one attribute.
                $table->unique(['attribute_id', 'value']);
            });
        }
    }

    /** Holds administrator-curated option lists; not dropped. */
    public function down(): void
    {
    }
};
