<?php

namespace App\Http\Controllers\Api\Shop;

use App\Exceptions\UnchargeableOrder;
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
        } catch (UnchargeableOrder $e) {
            // The order cannot be charged for — a non-positive total, or one
            // below the configured floor. Not a fault the shopper can retry
            // their way out of, so it is not dressed up as one.
            Log::warning('Stripe checkout refused an unchargeable order', [
                'reference' => $reference,
                'reason'    => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'This order cannot be paid by card. Please contact support.',
            ], 422);
        } catch (\RuntimeException $e) {
            // The client refused to start: no secret, or a live key on a build
            // that has not been permitted to use one. That is a deployment
            // fault, not a payment fault, and it used to escape this method
            // uncaught — answering 500, with the shopper told nothing useful
            // and the reason visible only in a stack trace.
            //
            // Logged at error level because nobody finds this by waiting: the
            // symptom is every card payment failing while the key, the webhook
            // and the channel all look correct.
            Log::error('Stripe is misconfigured — card payment cannot start.', [
                'reference' => $reference,
                'reason'    => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Card payment is not available yet.',
            ], 503);
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
