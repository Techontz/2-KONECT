<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every payment notification a provider has sent us, recorded once.
 *
 * Two jobs, both of which the system previously had no way to do.
 *
 * The first is idempotency. A provider that gets no answer retries, so the
 * same successful payment arrives two, three, ten times. The old handler
 * processed each arrival in full — crediting the vendor wallet again and
 * decrementing stock again on every one. The unique index below is what makes
 * a repeat a no-op: the second insert loses the race at the database, not at
 * an `if` statement that two concurrent requests can both pass.
 *
 * The second is evidence. A callback is a claim about money made by an
 * unauthenticated stranger — AzamPay publishes no signing mechanism, so there
 * is no way to prove otherwise. Writing the claim down, separately from the
 * order, means a human confirming a payment can see what was actually received
 * rather than only its effect.
 *
 * Purely additive: one new table, no existing column altered, no data rewritten.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_callbacks', function (Blueprint $table) {
            $table->id();

            // Which gateway sent it. Not hardcoded to AzamPay: the column
            // exists so a second provider does not need a second table.
            $table->string('provider', 40);

            // What the provider calls our order. For AzamPay this is
            // `utilityref`, which is matched against `orders.external_id`.
            $table->string('external_id', 120)->index();

            // The provider's own transaction reference. Empty string rather
            // than null when absent, because a nullable column does not
            // participate in a unique index the way this needs it to — two
            // NULLs are distinct in MySQL, so a provider that omitted the
            // reference could replay indefinitely.
            $table->string('provider_reference', 120)->default('');

            $table->string('status', 40);

            $table->decimal('amount', 12, 2)->nullable();
            $table->string('currency', 8)->nullable();

            // The body as received, minus the fields that identify a person.
            // The payer's phone number is not needed to reconcile a payment
            // and does not belong in a table this many people can read.
            $table->json('payload')->nullable();

            $table->timestamp('processed_at')->nullable();

            $table->timestamps();

            // The idempotency guarantee. One provider, one order, one
            // transaction reference — recorded exactly once.
            $table->unique(['provider', 'external_id', 'provider_reference'], 'payment_callbacks_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_callbacks');
    }
};
