<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\CheckoutPaymentChannel;
use App\Models\Order;
use App\Services\Stripe\CheckoutSessionBuilder;
use App\Services\Stripe\StripeClientFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;

/**
 * Starting a card payment for an order that already exists.
 *
 * Nothing here creates an order, prices one, or decides whether it may be paid
 * a particular way. The order was placed through the ordinary storefront
 * checkout, CheckoutPolicy already ruled on it, and this only opens a payment
 * page for what is already owed.
 *
 * The response is the Checkout URL and nothing else. No key, no session
 * object, no amount for the client to act on — a client that could see the
 * amount is a client somebody will eventually try to make send one.
 */
class StripeCheckoutController extends Controller
{
    public function __construct(
        private readonly StripeClientFactory $stripe,
        private readonly CheckoutSessionBuilder $builder,
    ) {
    }

    /** POST /api/shop/orders/{reference}/checkout-session */
    public function store(Request $request, string $reference): JsonResponse
    {
        if (! $this->stripe->configured()) {
            return response()->json([
                'message' => 'Card payment is not available yet.',
            ], 503);
        }

        // The channel has to be switched on by an administrator, separately
        // from the code being deployed. An inactive channel is not offered at
        // checkout and is refused here too, so a client holding a stale list
        // cannot start a payment through it.
        $channel = CheckoutPaymentChannel::active()->where('code', 'stripe')->first();

        if (! $channel) {
            return response()->json([
                'message' => 'Card payment is not available yet.',
            ], 503);
        }

        // Ownership is the query. A shopper cannot name somebody else's
        // reference and be told whether it exists.
        $lines = Order::with('product:id,name')
            ->where('user_id', $request->user()->id)
            ->where('reference', $reference)
            ->get();

        if ($lines->isEmpty()) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $first = $lines->first();
        $status = (string) ($first->payment_status ?? 'not_required');

        if ($status === 'verified') {
            return response()->json(['message' => 'This order is already paid.'], 422);
        }

        if ($status === 'not_required') {
            return response()->json([
                'message' => 'This order is paid on delivery, so there is nothing to pay now.',
            ], 422);
        }

        // A cancelled order is not a bill. Nothing else about the journey
        // matters here — an order can legitimately be paid while it is still
        // being prepared, or after it has shipped.
        if ($lines->every(fn (Order $line) => in_array($line->status, ['cancelled', 'refunded'], true))) {
            return response()->json(['message' => 'This order can no longer be paid.'], 422);
        }

        try {
            // The amount is recomputed inside the builder from these rows.
            // Nothing the caller sent about money is read — the request has no
            // body at all.
            $session = $this->builder->create($lines);
        } catch (ApiErrorException $e) {
            // Stripe's message can name the account and the request id. The
            // shopper gets none of it; the log gets enough to trace it.
            Log::error('Stripe checkout session failed', [
                'reference' => $reference,
                'error'     => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'We could not start the payment. Please try again.',
            ], 502);
        }

        return response()->json([
            // Deliberately the only field. The client's whole job is to go here.
            'url' => $session['url'],
        ], 201);
    }
}
