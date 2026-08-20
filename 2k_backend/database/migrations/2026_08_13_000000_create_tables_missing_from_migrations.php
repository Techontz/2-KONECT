<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backfills migrations for tables that exist in production but were never
 * captured as migration files — banners, notifications, the payment reference
 * tables and vendor payment options.
 *
 * Every block is guarded by `hasTable`, so running this against the live
 * database is a no-op and no existing row is touched. Its purpose is to make
 * the schema reproducible: without it a fresh database (the test suite, a new
 * environment) comes up missing five tables the application depends on.
 *
 * Dated ahead of the storefront migrations so a clean install builds these
 * before anything references them.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('banners')) {
            Schema::create('banners', function (Blueprint $table) {
                $table->id();
                $table->string('title')->nullable();
                $table->string('image');
                $table->string('link')->nullable();
                $table->string('alt')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->text('message');
                $table->string('to_role', 50)->default('admin');
                $table->string('type', 100)->nullable();
                $table->boolean('is_read')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('payment_types')) {
            Schema::create('payment_types', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('payment_methods')) {
            Schema::create('payment_methods', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_type_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('vendor_payment_options')) {
            Schema::create('vendor_payment_options', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
                $table->foreignId('payment_type_id')->constrained()->cascadeOnDelete();
                $table->foreignId('payment_method_id')->constrained()->cascadeOnDelete();
                $table->string('account');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // Deliberately not dropped: these hold production data, and this
        // migration exists to describe them, not to own their lifecycle.
    }
};
