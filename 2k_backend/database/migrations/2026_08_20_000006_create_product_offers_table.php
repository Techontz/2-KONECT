<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A second way to buy the same product.
 *
 * The catalogue keeps one row per product, exactly as it always has — that
 * row is the primary offer and every existing consumer (the vendor form, the
 * Flutter app, the admin panel) keeps writing to it untouched. This table
 * holds *alternatives*: the same phone, in stock in Dar for more, or shipped
 * from Shenzhen for less.
 *
 * Additive by design. A product with no rows here behaves exactly as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // Whose stock this is. Null means 2KONECT itself is sourcing it.
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();

            $table->string('availability', 16)->default('import')->index();
            $table->char('source_country', 2)->nullable();
            $table->decimal('price', 12, 2);
            $table->decimal('was_price', 12, 2)->nullable();
            $table->integer('stock')->default(0);
            $table->unsignedSmallInteger('lead_time_min_days')->nullable();
            $table->unsignedSmallInteger('lead_time_max_days')->nullable();
            $table->string('shipping_method', 16)->nullable();
            $table->string('fulfilment_location')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();
            $table->index(['product_id', 'is_active']);
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'offer_id')) {
                // Which offer was bought. Null — every historic order — means
                // the product's own primary offer.
                $table->foreignId('offer_id')->nullable()->after('product_id')
                    ->constrained('product_offers')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'offer_id')) {
                $table->dropConstrainedForeignId('offer_id');
            }
        });

        Schema::dropIfExists('product_offers');
    }
};
