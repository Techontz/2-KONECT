<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\CheckoutPaymentChannel as Channel;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Stripe\ApiRequestor;
use Tests\Support\FakeStripeHttpClient;
use Tests\TestCase;

/**
 * Opening a hosted card payment for an order that already exists.
 *
 * The transport is stubbed, so the real builder, the real serialisation and
 * the real client all run and the parameters asserted on are the exact ones
 * that would reach Stripe. No test here touches the network or needs a key
 * that works.
 */
class StripeCheckoutSessionTest extends TestCase
{
    use RefreshDatabase;

    private User $shopper;
    private User $other;
    private Vendor $vendor;
    private Product $product;
    private FakeStripeHttpClient $http;

    public function createApplication()
    {
        foreach ([
            'STRIPE_ENABLED' => 'true',
            'STRIPE_SECRET'  => 'sk_test_fake_for_tests',
            'STRIPE_CURRENCY' => 'TZS',
            'STRIPE_RETURN_BASE_URL' => 'https://www.2konect.shop',
            // Named though unused here, so a developer's own .env cannot leak
            // a different value into this class.
            'STRIPE_WEBHOOK_SECRET' => 'whsec_unused_in_this_suite',
            'STRIPE_ALLOW_LIVE' => 'false',
        ] as $k => $v) {
            putenv("$k=$v");
            $_ENV[$k] = $v;
            $_SERVER[$k] = $v;
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

    protected function tearDown(): void
    {
        parent::tearDown();

        foreach ([
            'STRIPE_ENABLED', 'STRIPE_SECRET', 'STRIPE_CURRENCY',
            'STRIPE_RETURN_BASE_URL', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_ALLOW_LIVE',
        ] as $k) {
            putenv($k);
            unset($_ENV[$k], $_SERVER[$k]);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'st-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000131',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Card Traders',
            'phone' => '0700000131', 'is_approved' => true,
        ]);

        $category = Category::create(['name' => 'Electronics']);
        $subcategory = Subcategory::create(['category_id' => $category->id, 'name' => 'Phones']);

        $this->product = Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $category->id,
            'subcategory_id' => $subcategory->id, 'name' => 'Local Kettle',
            'new_price' => 50000, 'stock' => 10, 'availability' => 'local',
            'source_country' => 'TZ', 'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'st-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000132',
        ]);

        $this->other = User::create([
            'name' => 'Other', 'email' => 'st-other@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000133',
        ]);

        $this->http = new FakeStripeHttpClient([
            FakeStripeHttpClient::session(),
        ]);
        ApiRequestor::setHttpClient($this->http);
    }

    private function activateStripe(): Channel
    {
        return tap(Channel::where('code', 'stripe')->first(), function (Channel $channel) {
            $channel->update(['is_active' => true]);
        });
    }

    private function order(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'reference'       => '2K-STRIPE01',
            'user_id'         => $this->shopper->id,
            'vendor_id'       => $this->vendor->id,
            'product_id'      => $this->product->id,
            'quantity'        => 2,
            'price'           => 50000,
            'total'           => 100000,
            'delivery_fee'    => 3000,
            'status'          => 'pending',
            'payment_method'  => 'stripe',
            'payment_status'  => 'awaiting_payment',
            'fulfilment_type' => 'local',
        ], $overrides));
    }

    private function createSession(?User $as = null, string $reference = '2K-STRIPE01')
    {
        Sanctum::actingAs($as ?? $this->shopper);

        return $this->postJson("/api/shop/orders/{$reference}/checkout-session");
    }

    /* ---------------------------------------------------------------- */
    /* the channel switch                                                */
    /* ---------------------------------------------------------------- */

    public function test_the_stripe_channel_ships_inactive(): void
    {
        $channel = Channel::where('code', 'stripe')->first();

        $this->assertNotNull($channel, 'The stripe channel row should exist.');
        $this->assertFalse((bool) $channel->is_active, 'Stripe must not be active by default.');
        $this->assertTrue((bool) $channel->is_gateway);
        $this->assertFalse((bool) $channel->requires_reference);
        $this->assertFalse((bool) $channel->requires_verification);
    }

    public function test_an_inactive_stripe_channel_refuses_to_open_a_session(): void
    {
        $this->order();

        $this->createSession()->assertStatus(503);

        $this->assertSame(0, Payment::count());
    }

    public function test_an_inactive_channel_is_not_offered_at_checkout(): void
    {
        $this->getJson('/api/shop/payment-channels')
            ->assertOk()
            ->assertJsonMissing(['code' => 'stripe']);
    }

    public function test_an_active_channel_is_offered_and_marked_as_a_gateway(): void
    {
        $this->activateStripe();

        $response = $this->getJson('/api/shop/payment-channels?import=1')->assertOk();

        $stripe = collect($response->json('channels'))->firstWhere('code', 'stripe');

        $this->assertNotNull($stripe);
        $this->assertTrue($stripe['is_gateway']);
        // A gateway has no till number to read off the screen.
        $this->assertNull($stripe['number']);
    }

    /* ---------------------------------------------------------------- */
    /* authorisation and payability                                      */
    /* ---------------------------------------------------------------- */

    public function test_another_customer_cannot_open_a_session_for_someone_elses_order(): void
    {
        $this->activateStripe();
        $this->order();

        // 404, not 403: naming a reference must not confirm it exists.
        $this->createSession($this->other)->assertStatus(404);

        $this->assertSame(0, Payment::count());
    }

    public function test_a_signed_out_caller_is_refused(): void
    {
        $this->activateStripe();
        $this->order();

        $this->postJson('/api/shop/orders/2K-STRIPE01/checkout-session')->assertStatus(401);
    }

    public function test_an_already_paid_order_cannot_be_paid_again(): void
    {
        $this->activateStripe();
        $this->order(['payment_status' => 'verified']);

        $this->createSession()->assertStatus(422);

        $this->assertSame(0, Payment::count());
    }

    public function test_a_cash_on_delivery_order_has_nothing_to_pay(): void
    {
        $this->activateStripe();
        $this->order(['payment_status' => 'not_required', 'payment_method' => 'cash_on_delivery']);

        $this->createSession()->assertStatus(422);
    }

    public function test_a_cancelled_order_cannot_be_paid(): void
    {
        $this->activateStripe();
        $this->order(['status' => 'cancelled']);

        $this->createSession()->assertStatus(422);
    }

    /* ---------------------------------------------------------------- */
    /* the amount                                                        */
    /* ---------------------------------------------------------------- */

    public function test_the_amount_is_recomputed_server_side_and_sent_in_minor_units(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();
        $items = $params['line_items'];

        // TZS 100,000 goods + TZS 3,000 delivery. TZS is a two-decimal
        // currency to Stripe — verified against their published zero-decimal
        // list, which does not contain it — so the figures are x100.
        $this->assertSame(10000000, $items[0]['price_data']['unit_amount']);
        $this->assertSame(300000, $items[1]['price_data']['unit_amount']);
        $this->assertSame('Delivery', $items[1]['price_data']['product_data']['name']);

        $this->assertSame('tzs', $items[0]['price_data']['currency']);
    }

    public function test_the_recorded_payment_matches_what_was_submitted(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $payment = Payment::first();

        $this->assertSame(10300000, (int) $payment->amount_minor);
        $this->assertSame('TZS', $payment->currency);
        $this->assertSame('2K-STRIPE01', $payment->reference);
        $this->assertSame(Payment::PENDING, $payment->status);
        // Money::fromMinorUnits is the inverse, never a hand-written /100.
        $this->assertEqualsWithDelta(103000.0, $payment->amount(), 0.001);
    }

    public function test_a_request_body_claiming_an_amount_is_ignored(): void
    {
        $this->activateStripe();
        $this->order();

        Sanctum::actingAs($this->shopper);
        $this->postJson('/api/shop/orders/2K-STRIPE01/checkout-session', [
            'amount' => 1,
            'amount_minor' => 1,
            'total' => 1,
            'currency' => 'usd',
        ])->assertStatus(201);

        // Priced from the order rows regardless of what was sent.
        $this->assertSame(10300000, (int) Payment::first()->amount_minor);
        $this->assertSame('tzs', $this->http->lastParams()['line_items'][0]['price_data']['currency']);
    }

    public function test_an_imported_order_carries_no_delivery_line(): void
    {
        $this->activateStripe();

        // CheckoutPolicy charges no delivery on an import, because what the
        // last mile costs is not known until the goods have landed. The
        // payment page must not invent one.
        $this->order(['fulfilment_type' => 'import', 'delivery_fee' => 0, 'source_country' => 'CN']);

        $this->createSession()->assertStatus(201);

        $items = $this->http->lastParams()['line_items'];

        $this->assertCount(1, $items);
        $this->assertSame(10000000, $items[0]['price_data']['unit_amount']);
    }

    /* ---------------------------------------------------------------- */
    /* what the session carries                                          */
    /* ---------------------------------------------------------------- */

    public function test_the_session_correlates_back_to_the_order(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();

        $this->assertSame('2K-STRIPE01', $params['client_reference_id']);
        $this->assertSame('2K-STRIPE01', $params['metadata']['order_reference']);
        // Also on the PaymentIntent, so an event that carries only that still
        // finds its order.
        $this->assertSame('2K-STRIPE01', $params['payment_intent_data']['metadata']['order_reference']);
    }

    public function test_dynamic_payment_methods_are_left_enabled(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        // Setting payment_method_types disables dynamic payment methods and
        // moves the decision out of the Dashboard into a deployment.
        $this->assertArrayNotHasKey('payment_method_types', $this->http->lastParams());
    }

    public function test_the_response_carries_only_the_url(): void
    {
        $this->activateStripe();
        $this->order();

        $response = $this->createSession()->assertStatus(201);

        $this->assertSame(['url'], array_keys($response->json()));
        $this->assertStringStartsWith('https://checkout.stripe.com/', $response->json('url'));
    }

    public function test_no_secret_key_is_ever_returned_to_the_client(): void
    {
        $this->activateStripe();
        $this->order();

        $body = $this->createSession()->assertStatus(201)->getContent();

        $this->assertStringNotContainsString('sk_test', $body);
        $this->assertStringNotContainsString('sk_live', $body);
        $this->assertStringNotContainsString('rk_', $body);
    }

    public function test_the_return_urls_point_at_the_order_page_and_settle_nothing(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();

        $this->assertStringContainsString('/account/orders/2K-STRIPE01/', $params['success_url']);
        $this->assertStringContainsString('stripe=success', $params['success_url']);
        $this->assertStringContainsString('stripe=cancelled', $params['cancel_url']);

        // Visiting the success URL is not an API call at all, so it cannot
        // settle anything. The order is untouched until a webhook arrives.
        $this->assertSame('awaiting_payment', Order::first()->payment_status);
    }

    /* ---------------------------------------------------------------- */
    /* saved cards                                                       */
    /* ---------------------------------------------------------------- */

    public function test_a_first_time_shopper_has_a_stripe_customer_created_for_them(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();

        $this->assertSame('always', $params['customer_creation']);
        $this->assertSame($this->shopper->email, $params['customer_email']);
        // `customer` and `customer_creation` are mutually exclusive; sending
        // both is an API error.
        $this->assertArrayNotHasKey('customer', $params);
    }

    public function test_a_returning_shopper_is_sent_as_their_existing_customer(): void
    {
        $this->activateStripe();
        $this->shopper->forceFill(['stripe_customer_id' => 'cus_test_existing'])->save();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();

        // Naming the customer is what makes Stripe offer their saved card
        // instead of an empty form.
        $this->assertSame('cus_test_existing', $params['customer']);
        $this->assertArrayNotHasKey('customer_creation', $params);
        $this->assertArrayNotHasKey('customer_email', $params);
    }

    public function test_the_shopper_is_offered_the_choice_to_keep_their_card(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        // `payment_method_save` is what puts a checkbox on Stripe's page and,
        // when ticked, saves the card with `allow_redisplay: always` — the only
        // value Checkout will prefill from on a later purchase.
        $this->assertSame(
            'enabled',
            $this->http->lastParams()['saved_payment_method_options']['payment_method_save'],
        );
    }

    public function test_setup_future_usage_is_never_sent(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();

        // The plausible-looking alternative, and the wrong one. A card saved
        // this way gets `allow_redisplay: limited`, which Stripe documents as
        // not appearing for return purchases — so it would store a card the
        // shopper can never use, while granting off-session charging that a
        // marketplace taking payment at the till has no business holding.
        $this->assertArrayNotHasKey('setup_future_usage', $params);
        $this->assertArrayNotHasKey('setup_future_usage', $params['payment_intent_data'] ?? []);
        $this->assertStringNotContainsString('setup_future_usage', json_encode($params));
    }

    public function test_saving_a_card_is_impossible_without_a_customer_to_attach_it_to(): void
    {
        // Stripe refuses to save either the customer or the card unless the
        // session names one, so the two parameters have to travel together.
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $params = $this->http->lastParams();

        $this->assertArrayHasKey('saved_payment_method_options', $params);
        $this->assertTrue(
            isset($params['customer']) || isset($params['customer_creation']),
            'A save-capable session must carry a customer or customer_creation.',
        );
    }

    public function test_no_card_detail_is_ever_sent_to_or_stored_by_2konect(): void
    {
        $this->activateStripe();
        $this->order();

        $this->createSession()->assertStatus(201);

        $sent = json_encode($this->http->lastParams());

        foreach (['card_number', 'cvv', 'cvc', 'exp_month', 'exp_year', 'number'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, (string) $sent);
        }

        // The payments row holds an amount and opaque Stripe ids, nothing else.
        $raw = json_encode(Payment::first()->raw);
        $this->assertStringNotContainsString('card', (string) $raw);
    }

    /* ---------------------------------------------------------------- */
    /* repeat requests                                                   */
    /* ---------------------------------------------------------------- */

    public function test_repeating_the_request_sends_the_same_idempotency_key(): void
    {
        $this->activateStripe();
        $this->order();

        $this->http = new FakeStripeHttpClient([
            FakeStripeHttpClient::session(['id' => 'cs_test_same']),
            FakeStripeHttpClient::session(['id' => 'cs_test_same']),
        ]);
        ApiRequestor::setHttpClient($this->http);

        $this->createSession()->assertStatus(201);
        $this->createSession()->assertStatus(201);

        // Two taps on "Pay" must not become two charges. The key is derived
        // from the reference and the amount, so Stripe returns the first
        // session rather than opening a second one.
        $this->assertCount(2, $this->http->requests);
        $this->assertNotNull($this->http->idempotencyKey(0));
        $this->assertSame(
            $this->http->idempotencyKey(0),
            $this->http->idempotencyKey(1),
            'A repeated request must carry the same idempotency key.',
        );

        // One session id, so one payments row rather than two.
        $this->assertSame(1, Payment::count());
    }

    /* ---------------------------------------------------------------- */
    /* the live-key guard                                                */
    /* ---------------------------------------------------------------- */

    public function test_a_live_key_is_refused_while_the_build_is_in_test_mode(): void
    {
        $this->activateStripe();
        $this->order();

        config(['stripe.secret' => 'sk_live_pretend', 'stripe.allow_live' => false]);
        // The factory is a singleton per request; clear the resolved instance
        // so the new config is read.
        app()->forgetInstance(\App\Services\Stripe\StripeClientFactory::class);

        $response = $this->createSession();

        $this->assertContains($response->status(), [500, 502, 503]);
        $this->assertSame('awaiting_payment', Order::first()->payment_status);
    }
}
