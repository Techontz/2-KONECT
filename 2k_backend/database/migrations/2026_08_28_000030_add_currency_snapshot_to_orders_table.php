<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the money meant on the day the order was placed.
 *
 * `orders.total` stays exactly what it is — Tanzanian Shillings, the canonical
 * amount, unchanged and unconverted. These three columns record the context it
 * was agreed in, and they exist for one reason: an administrator will change
 * the exchange rate, and when they do, every past order must go on saying what
 * it said.
 *
 * Without them, a $100 order placed at 2,500 would silently become $92.59 the
 * day the rate moved to 2,700 — the invoice, the receipt and the customer's
 * order history all quietly rewritten by a setting changed months later. With
 * them, an order is converted once, at the rate it was placed at, and never
 * again.
 *
 *   display_currency  what the customer was looking at
 *   charge_currency   what the gateway actually took, which may differ
 *   exchange_rate     1 USD = this many TZS, on that day
 *
 * All three are nullable. Existing orders were priced and paid in shillings
 * with no conversion involved, and a null here says exactly that rather than
 * inventing a rate they were never placed at.
 *
 * Purely additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'display_currency')) {
                $table->string('display_currency', 3)->nullable()->after('delivery_fee');
            }

            if (! Schema::hasColumn('orders', 'charge_currency')) {
                $table->string('charge_currency', 3)->nullable()->after('display_currency');
            }

            if (! Schema::hasColumn('orders', 'exchange_rate')) {
                $table->decimal('exchange_rate', 18, 6)->nullable()->after('charge_currency');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            foreach (['display_currency', 'charge_currency', 'exchange_rate'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
