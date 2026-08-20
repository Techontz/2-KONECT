<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Where a product physically is, and how long it takes to reach the buyer.
 *
 * This is the distinction 2KONECT is built around: an item already sitting in
 * a Tanzanian warehouse ships in days, while an item sourced abroad is cheaper
 * but travels first. Everything the storefront needs to say that out loud —
 * origin, transit mode, lead time — is stored on the product rather than
 * guessed at render time.
 *
 * Every column is additive and nullable-or-defaulted, so the 2,857 existing
 * rows stay valid and the Flutter app keeps reading the same payload.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'availability')) {
                // 'local' — in Tanzania now. 'import' — sourced from abroad.
                $table->string('availability', 16)->default('local')->after('stock')->index();
            }
            if (! Schema::hasColumn('products', 'source_country')) {
                // ISO 3166-1 alpha-2. Nullable so a seller who has not said
                // where an item ships from is not misreported as Tanzanian.
                $table->char('source_country', 2)->nullable()->after('availability');
            }
            if (! Schema::hasColumn('products', 'lead_time_min_days')) {
                $table->unsignedSmallInteger('lead_time_min_days')->nullable()->after('source_country');
            }
            if (! Schema::hasColumn('products', 'lead_time_max_days')) {
                $table->unsignedSmallInteger('lead_time_max_days')->nullable()->after('lead_time_min_days');
            }
            if (! Schema::hasColumn('products', 'shipping_method')) {
                // air | sea | road — only meaningful for imports.
                $table->string('shipping_method', 16)->nullable()->after('lead_time_max_days');
            }
            if (! Schema::hasColumn('products', 'fulfilment_location')) {
                // The warehouse or city the item ships out of.
                $table->string('fulfilment_location')->nullable()->after('shipping_method');
            }
        });

        // Everything already in the catalogue was listed by a Tanzanian seller
        // holding the stock, so it is local by definition.
        DB::table('products')
            ->whereNull('source_country')
            ->update([
                'availability'       => 'local',
                'source_country'     => 'TZ',
                'lead_time_min_days' => 1,
                'lead_time_max_days' => 3,
            ]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            foreach ([
                'availability', 'source_country', 'lead_time_min_days',
                'lead_time_max_days', 'shipping_method', 'fulfilment_location',
            ] as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
