<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Separate "allowed to sell" from "verified seller".
 *
 * The table only had `is_approved`, which was doing both jobs at once: it
 * gated publishing *and* drove the checkmark shown to shoppers. Those are
 * different promises — one says an application was accepted, the other says
 * the business behind it was checked — so they now have their own state.
 *
 * `is_approved` is deliberately kept and kept authoritative for permission,
 * because existing code and the 15 live vendors already depend on it. The new
 * `seller_status` mirrors it with room for rejected/suspended, and is
 * backfilled from it so nothing changes meaning on deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vendors')) {
            return;
        }

        Schema::table('vendors', function (Blueprint $table) {
            // ---- level 1: may this seller publish? ----
            if (! Schema::hasColumn('vendors', 'seller_status')) {
                $table->string('seller_status', 20)->default('pending')->after('is_approved');
            }
            if (! Schema::hasColumn('vendors', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('seller_status');
            }
            if (! Schema::hasColumn('vendors', 'admin_note')) {
                // Shown back to the seller when an application needs changes.
                $table->text('admin_note')->nullable()->after('approved_at');
            }

            // ---- level 2: does this seller carry the checkmark? ----
            if (! Schema::hasColumn('vendors', 'is_verified')) {
                $table->boolean('is_verified')->default(false)->after('admin_note');
            }
            if (! Schema::hasColumn('vendors', 'verification_status')) {
                // none → pending → verified | rejected
                $table->string('verification_status', 20)->default('none')->after('is_verified');
            }
            if (! Schema::hasColumn('vendors', 'verification_submitted_at')) {
                $table->timestamp('verification_submitted_at')->nullable()->after('verification_status');
            }
            if (! Schema::hasColumn('vendors', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verification_submitted_at');
            }
            if (! Schema::hasColumn('vendors', 'verification_note')) {
                $table->text('verification_note')->nullable()->after('verified_at');
            }
        });

        if (! Schema::hasColumn('vendors', 'seller_status')) {
            return;
        }

        // Carry the existing approvals across so no live seller loses the
        // ability to publish the moment this runs.
        DB::table('vendors')->where('is_approved', true)->update([
            'seller_status' => 'approved',
            'approved_at'   => DB::raw('COALESCE(approved_at, created_at)'),
        ]);

        DB::table('vendors')->where('is_approved', false)->update(['seller_status' => 'pending']);
    }

    /**
     * Deliberately does not drop the columns: they hold review decisions and
     * administrator notes that exist nowhere else.
     */
    public function down(): void
    {
    }
};
