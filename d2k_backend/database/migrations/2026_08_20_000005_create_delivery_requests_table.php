<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2KONECT Rides — the last mile.
 *
 * Once a shipment reaches Tanzania the buyer decides how it gets to them:
 * collect it themselves, or have it brought over. This table is deliberately
 * courier-shaped rather than order-shaped — it already carries a destination,
 * a window, a fee and an assignee — so the rides product can grow out of it
 * without the marketplace having to be rewritten around it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // The checkout this delivery belongs to.
            $table->string('order_reference', 40)->index();

            // pickup | delivery
            $table->string('mode', 16)->default('delivery');
            $table->string('recipient_name');
            $table->string('recipient_phone', 40);
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('pickup_point')->nullable();
            $table->date('preferred_date')->nullable();
            $table->string('preferred_window', 40)->nullable();
            $table->text('notes')->nullable();

            $table->decimal('fee', 12, 2)->default(0);
            // requested → scheduled → in_progress → delivered, or cancelled.
            $table->string('status', 24)->default('requested')->index();
            $table->string('courier_name')->nullable();
            $table->string('courier_phone', 40)->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_requests');
    }
};
