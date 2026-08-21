<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One index, on `products.source_country`.
 *
 * It is the only column the storefront queries that had no usable key. The
 * "shop by country" facet — `GROUP BY source_country ORDER BY COUNT(*)`, run
 * for the home feed and for the filter panel on every listing page — showed
 * `key=NULL` under EXPLAIN and scanned the whole table into a temporary table
 * and a filesort. The country *filter* (`WHERE source_country = 'CN'`) fell
 * back to walking the primary key.
 *
 * Deliberately the only index added. Every other catalogue query pattern was
 * checked with EXPLAIN and already resolves through an existing key:
 * `availability`, `category_id`, `subcategory_id`, `new_price`, `stock`,
 * `created_at` and the composite `(category_id, new_price)` all cover their
 * queries. Two patterns remain unindexed on purpose, because no index can
 * serve them: the deals shelf sorts on a computed discount ratio, and search
 * uses a leading-wildcard LIKE.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index('source_country', 'products_source_country_index');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_source_country_index');
        });
    }
};
