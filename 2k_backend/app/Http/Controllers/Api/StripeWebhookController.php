<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Stripe\WebhookProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

/**
 * The Stripe webhook.
 *
 * Unauthenticated by design and by necessity — Stripe cannot present a session
 * or a bearer token. The signature *is* the authentication: an HMAC over the
 * exact bytes of the request body, keyed with a secret only Stripe and this
 * application hold. That is a genuinely stronger guarantee than anything a
 * shared URL token gives, and it is why this endpoint may settle an order
 * where the AzamPay callback may not.
 *
 * Three things this must get right, all easy to get wrong:
 *
 *  1. **The raw body.** The signature covers the bytes as sent. Reading the
 *     parsed array and re-encoding it produces a different string and a
 *     verification failure that looks like an attack.
 *
 *  2. **No rate limiting.** Throttling Stripe turns a burst into retries,
 *     which turns retries into a larger burst.
 *
 *  3. **No payload logging.** A Checkout Session carries the shopper's name,
 *     email and address. The event id and type are enough to trace one.
 */
class StripeWebhookController extends Controller
{
    public function __construct(private readonly WebhookProcessor $processor)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $secret = trim((string) config('stripe.webhook_secret', ''));

        // Fails closed. An unconfigured endpoint refuses everything rather
        // than accepting it — "no secret" must never be read as "no check".
        if ($secret === '') {
            Log::error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set.');

            return response()->json(['message' => 'Webhook is not configured.'], 503);
        }

        $signature = $request->header('Stripe-Signature');

        if (! is_string($signature) || $signature === '') {
            return response()->json(['message' => 'Missing signature.'], 400);
        }

        try {
            $event = Webhook::constructEvent(
                // The bytes as received, before any parsing.
                $request->getContent(),
                $signature,
                $secret,
            );
        } catch (SignatureVerificationException $e) {
            // Not logged with the body. A failing signature is either a
            // misconfiguration or somebody probing, and neither is worth
            // writing an unverified payload to disk for.
            Log::warning('Stripe webhook signature verification failed.');

            return response()->json(['message' => 'Invalid signature.'], 400);
        } catch (\UnexpectedValueException $e) {
            return response()->json(['message' => 'Invalid payload.'], 400);
        }

        try {
            $outcome = $this->processor->handle($event);
        } catch (\Throwable $e) {
            // 500 so Stripe retries. The alternative — swallowing it and
            // answering 200 — loses the payment silently.
            Log::error('Stripe webhook handler threw', [
                'event_id' => $event->id,
                'type'     => $event->type,
            ]);

            return response()->json(['message' => 'Handler error.'], 500);
        }

        // 200 for anything understood, including a duplicate and a type we do
        // not act on. A non-2xx tells Stripe to try again, and retrying an
        // event that was correctly ignored achieves nothing but load.
        return response()->json(['received' => true, 'outcome' => $outcome]);
    }
}
