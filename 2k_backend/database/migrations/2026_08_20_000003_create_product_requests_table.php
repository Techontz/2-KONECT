<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "I can't find it — find it for me."
 *
 * A sourcing request is a real job for the 2KONECT team, not a contact form:
 * it is quoted, agreed, ordered and shipped, so it carries its own reference
 * and its own status ladder and shows up in the buyer's account alongside
 * their orders.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            // Nullable: a visitor can ask before they have an account, and the
            // phone number is what the team calls back on.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('name');
            $table->text('description')->nullable();
            $table->string('brand')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('budget_max', 12, 2)->nullable();
            $table->string('image')->nullable();

            $table->string('contact_name');
            $table->string('contact_phone', 40);
            $table->string('contact_email')->nullable();
            $table->string('delivery_city')->nullable();

            // submitted → reviewing → sourcing → quoted → confirmed → ordered
            // → in_transit → arrived → completed, or unavailable / cancelled.
            $table->string('status', 32)->default('submitted')->index();
            $table->decimal('quoted_price', 12, 2)->nullable();
            $table->unsignedSmallInteger('quoted_eta_min_days')->nullable();
            $table->unsignedSmallInteger('quoted_eta_max_days')->nullable();
            $table->timestamp('quoted_at')->nullable();
            $table->text('admin_note')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_requests');
    }
};
