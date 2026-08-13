<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Give a message the product it is about.
 *
 * A shopper messaging a seller from a product page is asking about *that*
 * product; without the link the seller receives "is this available?" with no
 * way to know what "this" is. The column is nullable so the 95 existing
 * messages — and the older vendor inbox that wrote them — keep working
 * untouched.
 *
 * This extends the messaging table the application already has rather than
 * introducing a second conversation system alongside it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('messages')) {
            return;
        }

        Schema::table('messages', function (Blueprint $table) {
            if (! Schema::hasColumn('messages', 'product_id')) {
                $table->foreignId('product_id')
                    ->nullable()
                    // A deleted product must not delete the conversation about
                    // it — the shopper and seller may still be settling an
                    // order — so the link is simply cleared.
                    ->after('receiver_id')
                    ->constrained()
                    ->nullOnDelete();
            }
        });

        Schema::table('messages', function (Blueprint $table) {
            $indexes = collect(Schema::getIndexes('messages'))->pluck('name');

            // The inbox reads "every message between these two people, newest
            // last"; without this it is a full scan per thread.
            if (! $indexes->contains('messages_sender_receiver_index')) {
                $table->index(['sender_id', 'receiver_id'], 'messages_sender_receiver_index');
            }
        });
    }

    /** Leaves the column in place: it carries conversation context. */
    public function down(): void
    {
    }
};
