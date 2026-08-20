<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The audit trail behind order tracking.
 *
 * `orders.status` is where an order is now; this table is how it got there.
 * The tracking timeline the buyer sees is read from these rows, so nothing on
 * that screen is invented in the frontend — a step is shown as done only
 * because it was actually recorded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_events', function (Blueprint $table) {
            $table->id();
            // Events attach to the checkout, not to a single line, because the
            // buyer tracks "my order" and a reference can span vendors.
            $table->string('reference', 40)->index();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 40);
            $table->string('title');
            $table->text('note')->nullable();
            $table->string('location')->nullable();
            $table->timestamp('happened_at')->useCurrent();
            $table->timestamps();

            $table->index(['reference', 'happened_at']);
        });

        // Seed the trail for orders placed before tracking existed, so their
        // timelines are not blank. Only facts already in the row are used.
        //
        // One event per checkout: a reference can span several vendor lines,
        // and the buyer placed one order, not three. `$seen` lives outside the
        // chunk callback so a reference straddling a chunk boundary still
        // produces a single row.
        $seen = [];

        DB::table('orders')
            ->select('id', 'reference', 'status', 'created_at')
            ->whereNotNull('reference')
            ->orderBy('id')
            ->chunkById(500, function ($orders) use (&$seen) {
                $rows = [];

                foreach ($orders as $order) {
                    if (isset($seen[$order->reference])) {
                        continue;
                    }
                    $seen[$order->reference] = true;

                    $rows[] = [
                        'reference'   => $order->reference,
                        'order_id'    => $order->id,
                        'status'      => 'pending',
                        'title'       => 'Order placed',
                        'happened_at' => $order->created_at,
                        'created_at'  => $order->created_at,
                        'updated_at'  => $order->created_at,
                    ];
                }

                if ($rows) {
                    DB::table('order_events')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
    }
};
