<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The exchange rate 2KONECT actually uses, and every rate it has ever used.
 *
 * Deliberately a table of rows rather than one editable value. A marketplace
 * that converts money needs to be able to answer "what rate did we apply on
 * the third of March, and who set it?" — and a settings row that is updated in
 * place cannot answer either question. Each change inserts; exactly one row is
 * active; the rest are the audit trail, at no extra cost.
 *
 * The rate is entered the way a person says it — 1 USD = 2,500 TZS — not as
 * the reciprocal. `decimal(18,6)` because a rate is not money: it needs more
 * precision than the amounts it converts, and floats are not allowed anywhere
 * near it.
 *
 * Purely additive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currency_rates', function (Blueprint $table) {
            $table->id();

            // What one unit of `base` costs in `quote`. Stored as a pair rather
            // than assumed, so a third currency later is a row and not a
            // rewrite.
            $table->string('base', 3)->default('USD');
            $table->string('quote', 3)->default('TZS');
            $table->decimal('rate', 18, 6);

            // Exactly one row per pair is active. Enforced in the service
            // inside a transaction rather than by a partial index, which MySQL
            // does not have.
            $table->boolean('is_active')->default(false)->index();

            // Who changed it. Nullable because a seeded opening rate has no
            // author, and because an administrator may later be deleted while
            // the financial record must not be.
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();

            // What it replaced, so the audit reads as a story rather than a
            // list of numbers needing to be diffed by eye.
            $table->decimal('previous_rate', 18, 6)->nullable();
            $table->string('note', 200)->nullable();

            $table->timestamps();

            $table->index(['base', 'quote', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('currency_rates');
    }
};
