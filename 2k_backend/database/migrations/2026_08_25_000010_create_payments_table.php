<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every attempt to pay for an order, and what became of it.
 *
 * Keyed on `reference`, not on an order id, because a payment belongs to a
 * *checkout* and the `orders` table holds one row per product line. This is
 * the same grouping `order_events` already uses.
 *
 * Deliberately not more columns on `orders`. An order has one payment state;
 * a shopper can have several payment attempts — a declined card, then a
 * successful one — and a state column cannot hold a history. Without this
 * table the declined attempt has nowhere to live and simply vanishes, which
 * is exactly the record you want when somebody says they were charged twice.
 *
 * `orders.payment_status` remains the source of truth for whether an order is
 * settled. This table is the evidence behind it.
 *
 * Purely additive: one new table, no existing column altered, no data touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            // The checkout this pays for. Indexed, not unique: a retry after a
            // decline is a second row against the same order.
            $table->string('reference', 40)->index();

            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // Not hardcoded to Stripe. AzamPay and any later gateway record
            // here too, rather than growing a table each.
            $table->string('provider', 40)->default('stripe');

            $table->string('status', 40)->default('pending')->index();

            // The amount as submitted to the gateway: an integer in the
            // currency's minor unit, exactly as it was sent. Stored this way
            // rather than as a decimal so that reconciling against Stripe is a
            // comparison of identical integers, with no rounding in between.
            // See App\Support\Money::toMinorUnits() for why the multiplication
            // lives in exactly one place.
            $table->string('currency', 8)->default('TZS');
            $table->unsignedBigInteger('amount_minor');

            // Stripe's own identifiers. Unique where present, so a webhook
            // cannot create a second row for a payment already recorded.
            $table->string('stripe_session_id', 255)->nullable()->unique();
            $table->string('stripe_payment_intent_id', 255)->nullable()->unique();
            $table->string('stripe_charge_id', 255)->nullable()->index();

            $table->string('failure_code', 80)->nullable();
            $table->string('failure_message', 255)->nullable();

            // Recorded for the audit trail only. Nothing in this release acts
            // on a refund or a dispute automatically — moving an order because
            // of one is a decision a person makes.
            $table->unsignedBigInteger('refunded_amount_minor')->default(0);

            // The gateway object as received, with anything identifying a
            // person removed. See Payment::redact().
            $table->json('raw')->nullable();

            $table->timestamp('paid_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
