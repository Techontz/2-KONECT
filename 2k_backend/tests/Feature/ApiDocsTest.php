<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The API documentation describes the API, and nothing else.
 *
 * Two properties matter more than completeness. It must not leak — a document
 * built from configuration could carry a key into a public page. And it must
 * not be able to describe an endpoint that does not exist, which is the whole
 * reason it is generated from the route table rather than written by hand.
 */
class ApiDocsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.api_docs_enabled' => true]);
    }

    public function test_it_is_off_unless_switched_on(): void
    {
        config(['app.api_docs_enabled' => false]);

        $this->get('/api/docs')->assertNotFound();
        $this->get('/api/docs.json')->assertNotFound();
    }

    public function test_it_serves_a_valid_openapi_document(): void
    {
        $spec = $this->getJson('/api/docs.json')->assertOk()->json();

        $this->assertSame('3.0.3', $spec['openapi']);
        $this->assertSame('2KONECT API', $spec['info']['title']);
        $this->assertSame('https://api.2konect.shop/api', $spec['servers'][0]['url']);
        $this->assertNotEmpty($spec['paths']);
    }

    public function test_it_documents_endpoints_that_actually_exist(): void
    {
        $paths = array_keys($this->getJson('/api/docs.json')->json('paths'));

        foreach (['/shop/products', '/shop/categories', '/shop/payment-channels'] as $expected) {
            $this->assertContains($expected, $paths, "{$expected} is registered but undocumented.");
        }
    }

    public function test_it_describes_the_currency_header_on_every_operation(): void
    {
        $spec = $this->getJson('/api/docs.json')->json();

        $this->assertSame('X-Currency', $spec['components']['parameters']['currency']['name']);
        $this->assertSame(['TZS', 'USD'], $spec['components']['parameters']['currency']['schema']['enum']);

        $operation = $spec['paths']['/shop/products']['get'];
        $this->assertContains(['$ref' => '#/components/parameters/currency'], $operation['parameters']);
    }

    public function test_it_marks_protected_endpoints_as_protected(): void
    {
        $spec = $this->getJson('/api/docs.json')->json();

        // A shopper's own orders need a token; the catalogue does not.
        $orders = $spec['paths']['/shop/orders']['get'] ?? null;
        $this->assertNotNull($orders, '/shop/orders should be documented.');
        $this->assertSame([['sanctum' => []]], $orders['security']);

        $this->assertArrayNotHasKey('security', $spec['paths']['/shop/products']['get']);
    }

    /**
     * The webhook is authenticated by a signature, not a session, and the
     * documentation has to say so or somebody will try to call it with a token.
     */
    public function test_it_documents_the_webhook_as_signature_authenticated(): void
    {
        $spec = $this->getJson('/api/docs.json')->json();

        if (! isset($spec['paths']['/webhooks/stripe'])) {
            $this->markTestSkipped('Stripe is not enabled in this environment, so the route is absent.');
        }

        $this->assertSame([['stripeSignature' => []]], $spec['paths']['/webhooks/stripe']['post']['security']);
    }

    public function test_it_leaves_the_admin_panel_out(): void
    {
        $paths = implode(' ', array_keys($this->getJson('/api/docs.json')->json('paths')));

        foreach (['filament', 'livewire', 'sanctum/', '_debugbar'] as $internal) {
            $this->assertStringNotContainsString($internal, $paths);
        }
    }

    /**
     * The one property that would make this dangerous.
     */
    public function test_it_cannot_leak_a_credential(): void
    {
        config([
            'stripe.secret'         => 'sk_live_SHOULD-NEVER-APPEAR',
            'stripe.webhook_secret' => 'whsec_SHOULD-NEVER-APPEAR',
            'database.connections.mysql.password' => 'SHOULD-NEVER-APPEAR-EITHER',
        ]);

        $body = $this->get('/api/docs.json')->assertOk()->getContent();

        foreach (['sk_live_', 'whsec_', 'SHOULD-NEVER-APPEAR', 'password'] as $needle) {
            $this->assertStringNotContainsStringIgnoringCase($needle, $body);
        }
    }

    public function test_the_viewer_renders_and_is_not_indexed(): void
    {
        $html = $this->get('/api/docs')->assertOk()->getContent();

        $this->assertStringContainsString('swagger', $html);
        $this->assertStringContainsString('noindex', $html);
        // Pinned, not floating: an unpinned CDN tag is somebody else's deploy
        // pipeline running in your browser.
        $this->assertStringContainsString('swagger-ui/5.17.14/', $html);
    }
}
