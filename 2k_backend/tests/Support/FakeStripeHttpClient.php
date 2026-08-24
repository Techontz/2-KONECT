<?php

namespace Tests\Support;

use Stripe\HttpClient\ClientInterface;

/**
 * A Stripe transport that answers from a script instead of the network.
 *
 * Installed with `ApiRequestor::setHttpClient()`, so the real `StripeClient`,
 * the real serialisation and the real `CheckoutSessionBuilder` all run. Only
 * the socket is replaced. That matters: the parameters recorded here are the
 * exact parameters that would have gone to Stripe, so a test can assert on the
 * amount actually submitted rather than on an intention to submit it.
 *
 * No test in this suite reaches api.stripe.com, and none needs a key that
 * works.
 */
class FakeStripeHttpClient implements ClientInterface
{
    /** @var list<array{method:string,url:string,params:array,headers:array}> */
    public array $requests = [];

    /** @var list<array{body:array,status:int}> */
    private array $responses;

    /** @param list<array> $responses Bodies to return, in order. */
    public function __construct(array $responses = [], private readonly int $status = 200)
    {
        $this->responses = $responses;
    }

    public function request($method, $absUrl, $headers, $params, $hasFile, $apiMode = 'v1', $maxNetworkRetries = null)
    {
        $this->requests[] = [
            'method'  => $method,
            'url'     => $absUrl,
            'params'  => $params,
            'headers' => $headers,
        ];

        $body = array_shift($this->responses) ?? [];

        return [json_encode($body), $this->status, []];
    }

    /** The parameters of the last request, for assertions. */
    public function lastParams(): array
    {
        return end($this->requests)['params'] ?? [];
    }

    /**
     * The Idempotency-Key sent with request `$index`, if any.
     *
     * Headers arrive as full `Name: value` strings rather than key-value
     * pairs, which is why this parses rather than looks up.
     */
    public function idempotencyKey(int $index = 0): ?string
    {
        foreach ($this->requests[$index]['headers'] ?? [] as $header) {
            if (is_string($header) && stripos($header, 'Idempotency-Key:') === 0) {
                return trim(substr($header, strlen('Idempotency-Key:')));
            }
        }

        return null;
    }

    /**
     * A Checkout Session response body.
     *
     * Shaped like the real thing in the fields this integration reads, and no
     * further — a fixture that mirrors an entire Stripe object mostly tests
     * that somebody can copy JSON.
     */
    public static function session(array $overrides = []): array
    {
        return array_merge([
            'id'             => 'cs_test_' . bin2hex(random_bytes(8)),
            'object'         => 'checkout.session',
            'url'            => 'https://checkout.stripe.com/c/pay/cs_test_123',
            'payment_status' => 'unpaid',
            'status'         => 'open',
            'currency'       => 'tzs',
            'amount_total'   => 0,
            'payment_intent' => 'pi_test_' . bin2hex(random_bytes(8)),
            'metadata'       => [],
        ], $overrides);
    }
}
