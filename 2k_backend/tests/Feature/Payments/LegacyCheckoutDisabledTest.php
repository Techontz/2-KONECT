<?php

namespace Tests\Feature\Payments;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The default posture: the legacy checkout surface does not exist.
 *
 * `azampay.enabled` is false unless somebody deliberately turns it on, and
 * while it is false the routes are never registered — so a request is a 404
 * rather than a refusal. There is nothing to probe, nothing to fingerprint,
 * and no code path to reach.
 *
 * Nothing calls these endpoints. The website checks out through
 * `POST /api/shop/orders`, the current Flutter app does the same, and the
 * retired app never had them in its source either.
 *
 * This class deliberately sets no environment overrides, so it runs against
 * the shipped defaults.
 */
class LegacyCheckoutDisabledTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_azampay_callback_is_not_routed_by_default(): void
    {
        $this->assertFalse(config('azampay.enabled'));

        $this->postJson('/api/v1/Checkout/Callback', [
            'utilityref'        => 'anything',
            'transactionstatus' => 'success',
        ])->assertStatus(404);
    }

    public function test_the_legacy_checkout_routes_are_not_routed_by_default(): void
    {
        $user = User::create([
            'name' => 'Shopper', 'email' => 'off-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000081',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/checkout', [])->assertStatus(404);
        $this->postJson('/api/checkout/confirm-manual', [])->assertStatus(404);
        $this->postJson('/api/checkout/vendors', [])->assertStatus(404);
    }

    public function test_the_storefront_checkout_is_unaffected(): void
    {
        $user = User::create([
            'name' => 'Shopper', 'email' => 'off-shopper2@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000082',
        ]);

        Sanctum::actingAs($user);

        // Reachable and validating, i.e. the route exists — 422 for an empty
        // basket, never 404.
        $this->postJson('/api/shop/orders', [])->assertStatus(422);
    }
}
