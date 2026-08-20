<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The shipping half of an order.
 *
 * A local order is a delivery; an imported order is a journey — dispatched
 * abroad, flown or shipped in, cleared, warehoused, then delivered. The buyer
 * is promised a date at checkout, so the promise is stored on the order rather
 * than recomputed from a product that may since have been edited.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'fulfilment_type')) {
                $table->string('fulfilment_type', 16)->default('local')->after('status')->index();
            }
            if (! Schema::hasColumn('orders', 'source_country')) {
                $table->char('source_country', 2)->nullable()->after('fulfilment_type');
            }
            if (! Schema::hasColumn('orders', 'shipping_method')) {
                $table->string('shipping_method', 16)->nullable()->after('source_country');
            }
            if (! Schema::hasColumn('orders', 'eta_min_days')) {
                $table->unsignedSmallInteger('eta_min_days')->nullable()->after('shipping_method');
            }
            if (! Schema::hasColumn('orders', 'eta_max_days')) {
                $table->unsignedSmallInteger('eta_max_days')->nullable()->after('eta_min_days');
            }
            if (! Schema::hasColumn('orders', 'estimated_arrival_at')) {
                $table->date('estimated_arrival_at')->nullable()->after('eta_max_days');
            }
            if (! Schema::hasColumn('orders', 'tracking_number')) {
                $table->string('tracking_number', 80)->nullable()->after('estimated_arrival_at');
            }
            if (! Schema::hasColumn('orders', 'carrier')) {
                $table->string('carrier', 80)->nullable()->after('tracking_number');
            }
        });

        // Historic orders were all local sales.
        DB::table('orders')->whereNull('source_country')->update([
            'fulfilment_type' => 'local',
            'source_country'  => 'TZ',
        ]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            foreach ([
                'fulfilment_type', 'source_country', 'shipping_method', 'eta_min_days',
                'eta_max_days', 'estimated_arrival_at', 'tracking_number', 'carrier',
            ] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
