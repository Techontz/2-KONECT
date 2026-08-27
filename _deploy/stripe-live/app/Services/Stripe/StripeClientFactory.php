<?php

namespace App\Services\Stripe;

use RuntimeException;
use Stripe\StripeClient;

/**
 * The one place a Stripe client is built.
 *
 * Three things it guarantees, none of which a caller should have to remember:
 *
 *  1. **An instance, never the global key.** `Stripe::setApiKey()` is
 *     deprecated and process-global — one call in a test or a queue worker
 *     changes which account every later call talks to.
 *
 *  2. **A pinned API version.** Without it the account's Dashboard default
 *     applies, so somebody clicking "upgrade" there can change the shape of
 *     the objects this code parses, with no deployment and no warning.
 *
 *  3. **Test mode unless somebody says otherwise.** A `sk_live_`/`rk_live_`
 *     key is refused unless `stripe.allow_live` is explicitly set. This
 *     integration has never been exercised against real money, and a copied
 *     env file should not be the thing that changes that.
 */
class StripeClientFactory
{
    private ?StripeClient $client = null;

    public function make(): StripeClient
    {
        return $this->client ??= new StripeClient([
            'api_key'         => $this->secret(),
            'stripe_version'  => (string) config('stripe.api_version'),
        ]);
    }

    /** Whether Stripe is usable at all, without throwing to find out. */
    public function configured(): bool
    {
        $secret = (string) config('stripe.secret', '');

        return (bool) config('stripe.enabled') && $secret !== '';
    }

    /**
     * The API key, validated.
     *
     * Fails closed and says which of the two problems it is, because
     * "unconfigured" and "live key in a test-mode build" need very different
     * responses from whoever reads the error.
     */
    private function secret(): string
    {
        $secret = trim((string) config('stripe.secret', ''));

        if ($secret === '') {
            throw new RuntimeException('Stripe is not configured: STRIPE_SECRET is empty.');
        }

        if ($this->isLiveKey($secret) && ! config('stripe.allow_live')) {
            // The message deliberately names neither the key nor any part of
            // it. An error string ends up in logs, in tickets and on screens.
            throw new RuntimeException(
                'Refusing to use a live Stripe key: this build is configured for test mode. '
                . 'Set STRIPE_ALLOW_LIVE=true only when live payments are genuinely intended.',
            );
        }

        return $secret;
    }

    private function isLiveKey(string $secret): bool
    {
        return str_starts_with($secret, 'sk_live_') || str_starts_with($secret, 'rk_live_');
    }
}
