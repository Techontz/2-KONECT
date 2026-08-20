<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A short summary, separate from the full description.
 *
 * `description` already exists and holds long-form text — often a whole spec
 * sheet. Cards and search results need a single readable line, and truncating
 * a spec sheet produces "Display: 6.7-inch FHD+ Super AMO…". Nullable, so all
 * 2,857 existing products are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'short_description')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('short_description', 300)->nullable()->after('name');
            });
        }
    }

    /** Holds seller-written copy; not dropped. */
    public function down(): void
    {
    }
};
