<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether an order has actually been paid for, as opposed to which method was
 * chosen.
 *
 * `orders.payment_method` already records the choice. Nothing recorded the
 * outcome, which was survivable while every order was cash on delivery — the
 * money arrives with the courier or the order is cancelled. It stops being
 * survivable the moment an order is prepaid: somebody types a transaction
 * reference into a form, and without these columns the only place that claim
 * could live is the shopper's word.
 *
 * `payment_status` values:
 *   not_required          cash on delivery — money changes hands at the door
 *   awaiting_payment      prepaid, nothing submitted yet
 *   awaiting_verification the shopper has sent a reference; a human must check
 *   verified              an administrator confirmed the money arrived
 *   rejected              an administrator could not find the payment
 *
 * Existing rows default to `not_required`, which is exactly what they are.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_status', 32)
                ->default('not_required')
                ->after('payment_method')
                ->index();

            // What the shopper typed. Stored as given: it is evidence, and
            // normalising it would destroy the thing being checked against
            // the mobile-money statement.
            $table->string('payment_reference', 120)->nullable()->after('payment_status');
            $table->timestamp('payment_submitted_at')->nullable()->after('payment_reference');

            $table->timestamp('payment_verified_at')->nullable()->after('payment_submitted_at');

            // Who confirmed it. An audit trail is the point of manual
            // verification; without it "verified" is anonymous.
            $table->foreignId('payment_verified_by')
                ->nullable()
                ->after('payment_verified_at')
                ->constrained('users')
                ->nullOnDelete();

            $table->string('payment_note', 255)->nullable()->after('payment_verified_by');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_verified_by');
            $table->dropColumn([
                'payment_status',
                'payment_reference',
                'payment_submitted_at',
                'payment_verified_at',
                'payment_note',
            ]);
        });
    }
};
