<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Administrator-defined verification paperwork.
 *
 * What a seller must supply differs by business type and changes over time —
 * a sole trader in Kariakoo does not hold the same papers as a registered
 * company. Hard-coding the list would mean a deploy every time the rules move,
 * so the requirements live in a table the admin edits, and each seller's
 * uploads reference them.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('verification_requirements')) {
            Schema::create('verification_requirements', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description')->nullable();
                // file → upload; text → a reference number such as a TIN.
                $table->string('document_type', 20)->default('file');
                $table->boolean('is_required')->default(true);
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['is_active', 'sort_order']);
            });
        }

        if (! Schema::hasTable('vendor_documents')) {
            Schema::create('vendor_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
                // Kept when a requirement is retired, so the reviewer can still
                // see what was submitted against it at the time.
                $table->foreignId('verification_requirement_id')->nullable()
                    ->constrained()->nullOnDelete();

                $table->string('file_path')->nullable();
                $table->string('value')->nullable();

                $table->string('status', 20)->default('pending');
                $table->text('review_note')->nullable();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();

                $table->index(['vendor_id', 'status']);
            });
        }
    }

    /** Holds seller-submitted paperwork and review decisions; not dropped. */
    public function down(): void
    {
    }
};
