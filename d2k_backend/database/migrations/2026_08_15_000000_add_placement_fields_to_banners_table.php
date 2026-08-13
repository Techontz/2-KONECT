<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turn `banners` into a homepage placement system.
 *
 * The table could previously only say "here is an image, it is on or off".
 * The homepage needs to know *where* a banner goes (the wide hero carousel, the
 * fixed card beside it, or a strip between product rows), what it should say,
 * where it links, and when it should run — otherwise every promotion has to be
 * hard-coded into the page and an administrator can never change one.
 *
 * Every column is additive and nullable, so the three existing rows keep
 * working exactly as they do today.
 */
return new class extends Migration
{
    /** Where a banner may appear on the homepage. */
    private const PLACEMENTS = ['hero', 'hero_side', 'promo', 'editorial'];

    public function up(): void
    {
        if (! Schema::hasTable('banners')) {
            return;
        }

        Schema::table('banners', function (Blueprint $table) {
            if (! Schema::hasColumn('banners', 'placement')) {
                $table->string('placement', 20)->default('hero')->after('title');
            }
            if (! Schema::hasColumn('banners', 'subtitle')) {
                $table->string('subtitle')->nullable()->after('title');
            }
            if (! Schema::hasColumn('banners', 'cta_label')) {
                $table->string('cta_label', 60)->nullable()->after('link');
            }
            // A separate portrait-ish crop: the wide hero artwork is unreadable
            // when squeezed onto a phone.
            if (! Schema::hasColumn('banners', 'mobile_image')) {
                $table->string('mobile_image')->nullable()->after('image');
            }
            if (! Schema::hasColumn('banners', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(0)->after('is_active');
            }
            if (! Schema::hasColumn('banners', 'starts_at')) {
                $table->timestamp('starts_at')->nullable()->after('sort_order');
            }
            if (! Schema::hasColumn('banners', 'ends_at')) {
                $table->timestamp('ends_at')->nullable()->after('starts_at');
            }
            // Lets a banner be authored as brand artwork instead of an upload.
            if (! Schema::hasColumn('banners', 'theme')) {
                $table->string('theme', 20)->nullable()->after('cta_label');
            }
        });

        if (! Schema::hasColumn('banners', 'placement')) {
            return;
        }

        // Existing rows predate placements. They were uploaded as homepage
        // artwork, so they stay in the hero rotation rather than disappearing —
        // but they sort after the curated ones added below.
        DB::table('banners')
            ->whereNull('placement')
            ->orWhere('placement', '')
            ->update(['placement' => 'hero', 'sort_order' => 100]);
    }

    /**
     * Deliberately does not drop the columns: they hold campaign copy and
     * scheduling an administrator entered, which exists nowhere else.
     */
    public function down(): void
    {
    }
};
