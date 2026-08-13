<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes only — no column is added, changed or dropped, so existing rows are
 * untouched. The storefront sorts and filters on these columns on every
 * listing request; without them MySQL filesorts the whole products table.
 */
return new class extends Migration
{
    /** Index name => columns. */
    private array $indexes = [
        'products_new_price_index'  => ['new_price'],
        'products_created_at_index' => ['created_at'],
        'products_stock_index'      => ['stock'],
        // Covers the common "products in this category, cheapest first" query.
        'products_category_price_index' => ['category_id', 'new_price'],
    ];

    public function up(): void
    {
        $existing = $this->existingIndexNames();

        Schema::table('products', function (Blueprint $table) use ($existing) {
            foreach ($this->indexes as $name => $columns) {
                if (! in_array($name, $existing, true)) {
                    $table->index($columns, $name);
                }
            }
        });

        // Full-text search over the catalogue. MySQL/InnoDB only — SQLite (used
        // by the test suite) has no equivalent, and search falls back to LIKE
        // matching there, so this is best-effort rather than required.
        if (DB::getDriverName() === 'mysql' && ! in_array('products_fulltext_index', $existing, true)) {
            try {
                DB::statement(
                    'ALTER TABLE products ADD FULLTEXT products_fulltext_index (name, description)'
                );
            } catch (\Throwable $e) {
                // Non-fatal: search degrades to LIKE matching.
            }
        }
    }

    public function down(): void
    {
        $existing = $this->existingIndexNames();

        Schema::table('products', function (Blueprint $table) use ($existing) {
            foreach (array_keys($this->indexes) as $name) {
                if (in_array($name, $existing, true)) {
                    $table->dropIndex($name);
                }
            }
        });

        if (in_array('products_fulltext_index', $existing, true)) {
            try {
                DB::statement('ALTER TABLE products DROP INDEX products_fulltext_index');
            } catch (\Throwable $e) {
                // Ignore — nothing depends on it.
            }
        }
    }

    /**
     * Index names already on the table.
     *
     * Uses Laravel's schema introspection rather than `SHOW INDEX`, which is
     * MySQL-only and blows up on the SQLite database the tests run against.
     */
    private function existingIndexNames(): array
    {
        try {
            return array_map(
                fn (array $index) => $index['name'],
                Schema::getIndexes('products')
            );
        } catch (\Throwable $e) {
            return [];
        }
    }
};
