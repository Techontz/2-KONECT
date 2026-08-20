<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two things the sourcing desk kept having to ask for by phone.
 *
 * Where a shopper would rather we bought from, and how soon they actually
 * need it. Both change what the desk does — a request that must land in two
 * weeks is quoted air freight, one that can wait goes by sea for a third of
 * the price — and until now neither was captured anywhere.
 *
 * Purely additive: both columns are nullable with no default, so every
 * existing row stays valid, and every client that does not send them keeps
 * working unchanged. Nothing reads them without a null check.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_requests', function (Blueprint $table) {
            // ISO 3166-1 alpha-2, matching products.source_country, so a
            // request and a listing can be compared without translation.
            $table->char('preferred_country', 2)->nullable()->after('brand');
            $table->string('urgency', 16)->nullable()->after('preferred_country');
        });
    }

    public function down(): void
    {
        Schema::table('product_requests', function (Blueprint $table) {
            $table->dropColumn(['preferred_country', 'urgency']);
        });
    }
};
