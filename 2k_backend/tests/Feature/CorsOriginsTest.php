<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The domains the storefront is served from must survive a deployment.
 *
 * This exists because they did not. `2konect.shop` had been added to the CORS
 * allow-list by hand on the production server rather than committed, so a
 * deployment that shipped `config/cors.php` replaced the working file with one
 * that did not list it — and every browser request from the live storefront was
 * blocked at once.
 *
 * It was invisible from the outside: the API went on answering 200 to curl,
 * because curl does not enforce CORS. Only a browser saw it, and what a browser
 * saw was "We couldn't load the storefront".
 *
 * A test is the right place for this. A comment saying "remember the .shop
 * domain" is a comment somebody will not read; a failing test is a deployment
 * that does not happen.
 */
class CorsOriginsTest extends TestCase
{
    use RefreshDatabase;

    /** Every origin the storefront is actually served from today. */
    private const LIVE_ORIGINS = [
        'https://2konect.shop',
        'https://www.2konect.shop',
    ];

    public function test_every_live_storefront_domain_is_allowed(): void
    {
        $allowed = config('cors.allowed_origins');

        foreach (self::LIVE_ORIGINS as $origin) {
            $this->assertContains(
                $origin,
                $allowed,
                "{$origin} is missing from cors.allowed_origins. Deploying this would "
                . 'block every browser request from the live storefront while the API '
                . 'went on answering 200 to curl.',
            );
        }
    }

    public function test_the_api_answers_a_browser_request_from_the_live_storefront(): void
    {
        foreach (self::LIVE_ORIGINS as $origin) {
            $response = $this->call('OPTIONS', '/api/shop/currency', [], [], [], [
                'HTTP_ORIGIN'                         => $origin,
                'HTTP_ACCESS_CONTROL_REQUEST_METHOD'  => 'GET',
                'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'x-currency,authorization,content-type',
            ]);

            $this->assertSame(
                $origin,
                $response->headers->get('Access-Control-Allow-Origin'),
                "The preflight from {$origin} was refused.",
            );
        }
    }

    /**
     * The header the storefront sends on every single request.
     *
     * A custom header on a GET forces a preflight, so if this is not allowed
     * then nothing loads — not one product, not one category.
     */
    public function test_the_currency_header_survives_a_preflight(): void
    {
        $response = $this->call('OPTIONS', '/api/shop/products', [], [], [], [
            'HTTP_ORIGIN'                         => 'https://www.2konect.shop',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD'  => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'x-currency',
        ]);

        $this->assertNotNull($response->headers->get('Access-Control-Allow-Origin'));
        $this->assertStringContainsStringIgnoringCase(
            'x-currency',
            (string) $response->headers->get('Access-Control-Allow-Headers'),
        );
    }

    /**
     * A request without the header must still work.
     *
     * The mobile app on an older build sends none, and so does anything else
     * that predates the currency system. Backwards compatibility here is the
     * difference between a new feature and a breaking change.
     */
    public function test_a_request_with_no_currency_header_is_served_in_shillings(): void
    {
        $this->getJson('/api/shop/currency')
            ->assertOk()
            ->assertJsonPath('default_currency', 'TZS');
    }

    public function test_an_unsupported_currency_header_falls_back_rather_than_failing(): void
    {
        $this->getJson('/api/shop/products', ['X-Currency' => 'KES'])->assertOk();
        $this->getJson('/api/shop/products', ['X-Currency' => 'nonsense'])->assertOk();
    }
}
