<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every Stripe webhook event we have seen, recorded once.
 *
 * Stripe redelivers. A handler that receives no 2xx is retried, and the same
 * event can arrive several times — so processing has to be idempotent, and the
 * only reliable way to make it so is to let the database decide the winner
 * rather than an `if` two concurrent requests can both pass.
 *
 * Stripe's own `evt_…` id is the primary key. That is the guarantee: a second
 * delivery of the same event cannot insert, so it cannot process.
 *
 * Purely additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_events', function (Blueprint $table) {
            // Stripe's event id, e.g. `evt_1P...`. Not an auto-increment: the
            // uniqueness that matters is theirs, not ours.
            $table->string('id', 255)->primary();

            $table->string('type', 120)->index();

            // The event as received, redacted. Kept so that a payment can be
            // reconciled later without asking Stripe again.
            $table->json('payload')->nullable();

            // Null until the handler has finished. A row with a null
            // `processed_at` and a non-null `error` is one to look at.
            $table->timestamp('processed_at')->nullable();
            $table->text('error')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_events');
    }
};
