<?php

namespace Tests\Feature\Payments;

use App\Models\CheckoutPaymentChannel as Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The shipped default: Stripe is off, in two independent ways.
 *
 * `config('stripe.enabled')` decides whether the routes exist at all, and the
 * `stripe` row in `checkout_payment_channels` decides whether a shopper is
 * ever offered it. Both are off, and neither flips by deploying code.
 *
 * This class deliberately sets no environment overrides, so it runs against
 * exactly what a fresh deployment gets.
 */
class StripeDisabledTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Every Stripe variable this class depends on, set explicitly.
     *
     * Named in full rather than inherited from whatever `.env` happens to hold,
     * because a developer who configures Stripe locally must not change what
     * this suite proves. Set before the application boots: routes are
     * registered during bootstrap, so `stripe.enabled` has to be decided by
     * then.
     */
    public function createApplication()
    {
        foreach ([
            'STRIPE_ENABLED' => 'false',
            'STRIPE_ALLOW_LIVE' => 'false',
            'STRIPE_SECRET' => '',
            'STRIPE_WEBHOOK_SECRET' => '',
        ] as $key => $value) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
            // Laravel memoises its env repository and loads .env through an
            // *immutable* writer, so the first boot in the process wins: a
            // value read from a developer's own .env is remembered and a later
            // putenv() is ignored. Dropping the repository forces the next boot
            // to read the values set above rather than the ones this machine
            // happens to have configured.
            \Illuminate\Support\Env::enablePutenv();


        return parent::createApplication();
    }

    public function test_stripe_is_disabled_by_default(): void
    {
        $this->assertFalse((bool) config('stripe.enabled'));
        $this->assertFalse((bool) config('stripe.allow_live'), 'Live keys must not be permitted by default.');
    }

    public function test_neither_stripe_route_is_registered(): void
    {
        $this->postJson('/api/webhooks/stripe', [])->assertStatus(404);

        $user = User::create([
            'name' => 'Shopper', 'email' => 'sd-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000151',
        ]);

        Sanctum::actingAs($user);
        $this->postJson('/api/shop/orders/2K-ANY00001/checkout-session')->assertStatus(404);
    }

    public function test_the_stripe_channel_exists_but_is_inactive(): void
    {
        $channel = Channel::where('code', 'stripe')->first();

        // Present, so an administrator can find and switch it on — but off, so
        // nobody is offered it until they do.
        $this->assertNotNull($channel);
        $this->assertFalse((bool) $channel->is_active);
    }

    public function test_the_existing_manual_channels_are_unaffected(): void
    {
        Channel::create([
            'code' => Channel::LIPA_NAMBA, 'label' => 'Lipa Namba',
            'merchant_name' => '2KONECT', 'number' => '555123',
            'is_active' => true, 'requires_reference' => true,
            'requires_verification' => true, 'sort_order' => 1,
        ]);

        $response = $this->getJson('/api/shop/payment-channels')->assertOk();
        $channels = collect($response->json('channels'));

        $lipa = $channels->firstWhere('code', 'lipa_namba');

        $this->assertNotNull($lipa);
        $this->assertFalse($lipa['is_gateway'], 'A manual channel must not be marked as a gateway.');
        $this->assertSame('555123', $lipa['number']);
        $this->assertTrue($lipa['requires_reference']);

        // Cash on delivery still offered for a local basket, still refused for
        // an import. Untouched by any of this.
        $this->assertTrue($response->json('cash_on_delivery'));
        $this->getJson('/api/shop/payment-channels?import=1')
            ->assertOk()
            ->assertJsonPath('cash_on_delivery', false);
    }
}
