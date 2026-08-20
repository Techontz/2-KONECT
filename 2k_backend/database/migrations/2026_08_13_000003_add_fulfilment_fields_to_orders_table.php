<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the fields an order needs to be fulfilled and shown back to the
 * shopper. Every column is nullable and additive, so the 98 existing orders
 * keep their data and stay valid.
 *
 * `reference` is the human-quotable order number. Existing rows already carry
 * a per-checkout UUID in `external_id`, so they are backfilled from that
 * rather than left blank.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'reference')) {
                $table->string('reference', 40)->nullable()->after('id')->index();
            }
            if (! Schema::hasColumn('orders', 'payment_method')) {
                $table->string('payment_method')->nullable()->after('payment_provider');
            }
            if (! Schema::hasColumn('orders', 'delivery_address')) {
                $table->text('delivery_address')->nullable()->after('payment_method');
            }
            if (! Schema::hasColumn('orders', 'customer_phone')) {
                $table->string('customer_phone', 40)->nullable()->after('delivery_address');
            }
            if (! Schema::hasColumn('orders', 'delivery_fee')) {
                $table->decimal('delivery_fee', 12, 2)->default(0)->after('total');
            }
        });

        // Backfill: give every historic order a reference derived from the
        // checkout it belonged to, so order history is never blank.
        DB::table('orders')
            ->whereNull('reference')
            ->orderBy('id')
            ->chunkById(500, function ($orders) {
                foreach ($orders as $order) {
                    DB::table('orders')->where('id', $order->id)->update([
                        'reference' => $order->external_id
                            ? 'D2K-' . strtoupper(substr(str_replace('-', '', $order->external_id), 0, 10))
                            : 'D2K-' . str_pad((string) $order->id, 8, '0', STR_PAD_LEFT),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            foreach (['reference', 'payment_method', 'delivery_address', 'customer_phone', 'delivery_fee'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
