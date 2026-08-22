<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\CheckoutPaymentChannel;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Support\CheckoutPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * What a customer may pay with, and telling us they have paid.
 *
 * Verification is deliberately not here. An administrator confirms a payment
 * from the admin panel, where the person doing it is known and the action is
 * recorded; there is no customer-reachable route that can move an order to
 * "paid", because a route that could would make the reference field the only
 * thing standing between a stranger and free goods.
 */
class CheckoutPaymentController extends Controller
{
    /**
     * The channels this basket may use.
     *
     * `import=1` asks for the prepaid set. The client sends what it believes
     * it has; nothing is trusted from it, because the same rule is applied
     * again against the real products when the order is placed.
     */
    public function channels(Request $request): JsonResponse
    {
        $prepaid = $request->boolean('import');

        $channels = CheckoutPolicy::channelsFor($prepaid)
            ->map(fn (CheckoutPaymentChannel $channel) => $channel->toStorefront())
            ->values();

        return response()->json([
            'requires_prepayment' => $prepaid,
            // Cash on delivery is not a configured channel — it needs no till
            // number — so its availability is reported rather than listed.
            'cash_on_delivery'    => ! $prepaid,
            'charges_delivery'    => ! $prepaid,
            'channels'            => $channels,
        ]);
    }

    /**
     * "I have paid" — record the reference and hand the order to a human.
     *
     * This never marks anything paid. It moves the order to
     * `awaiting_verification`, which is a queue, not a state of settlement.
     */
    public function submit(Request $request, string $reference): JsonResponse
    {
        $data = $request->validate([
            'payment_reference' => 'required|string|min:4|max:120',
        ]);

        $lines = Order::where('user_id', $request->user()->id)
            ->where('reference', $reference)
            ->get();

        if ($lines->isEmpty()) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $first = $lines->first();

        if ($first->payment_status === 'not_required') {
            return response()->json([
                'message' => 'This order is paid on delivery, so there is nothing to confirm.',
            ], 422);
        }

        if ($first->payment_status === 'verified') {
            return response()->json(['message' => 'This order is already paid.'], 422);
        }

        DB::transaction(function () use ($lines, $data, $reference, $first) {
            // Every line of the checkout carries the same payment, so they all
            // move together — the order is one payment, not one per product.
            Order::where('reference', $reference)->update([
                'payment_reference'    => $data['payment_reference'],
                'payment_status'       => 'awaiting_verification',
                'payment_submitted_at' => now(),
            ]);

            OrderEvent::create([
                'reference'   => $reference,
                'order_id'    => $first->id,
                'status'      => $first->status,
                'title'       => 'Payment submitted',
                'note'        => 'Waiting for 2KONECT to confirm the payment.',
                'happened_at' => now(),
            ]);
        });

        return response()->json([
            'message'        => 'Thank you. We are confirming your payment.',
            'payment_status' => 'awaiting_verification',
        ]);
    }
}
