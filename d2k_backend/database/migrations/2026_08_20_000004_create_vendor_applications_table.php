<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Applications to sell on 2KONECT.
 *
 * Registering an account does not make anyone a seller: an application lands
 * here, an administrator reviews it, and only approval creates the vendor
 * record. That keeps the existing `vendors.is_approved` gate authoritative
 * while giving the marketplace a real front door.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendor_applications', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('full_name');
            $table->string('business_name');
            $table->string('phone', 40);
            $table->string('email')->nullable();
            $table->string('country', 2)->default('TZ');
            $table->string('region')->nullable();
            $table->string('city')->nullable();
            $table->string('business_type', 40)->nullable();
            $table->string('category')->nullable();
            $table->text('products')->nullable();
            $table->string('website')->nullable();
            $table->string('id_number', 60)->nullable();

            $table->string('status', 24)->default('pending')->index();
            $table->text('admin_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            // Set when an approval creates the seller account, so the two are
            // traceable to each other afterwards.
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_applications');
    }
};
