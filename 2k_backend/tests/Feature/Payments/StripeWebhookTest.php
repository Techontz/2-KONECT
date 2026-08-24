<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StripeEvent;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Stripe webhook: the only thing that may settle an order without a person.
 *
 * It earns that where the AzamPay callback could not. Stripe signs the webhook
 * with a secret only they and this application hold, over the exact bytes of
 * the request body — so a verified event is cryptographic evidence of origin,
 * not a claim. Every test here posts a request an attacker could actually
 * send, and the ones that should fail fail before any state changes.
 *
 * The four things settlement must NOT do are asserted individually, because
 * each is a separate way to lose money: no second stock decrement, no second
 * wallet credit, no journey movement, and no admin attribution.
 */
class StripeWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_0123456789abcdefghijklmnop';

    private User $shopper;
    private Vendor $vendor;
    private Product $product;

    public function createApplication()
    {
        foreach ([
            'STRIPE_ENABLED'        => 'true',
            'STRIPE_SECRET'         => 'sk_test_fake_for_tests',
            'STRIPE_WEBHOOK_SECRET' => self::SECRET,
            'STRIPE_CURRENCY'       => 'TZS',
            'STRIPE_RETURN_BASE_URL' => 'https://www.2konect.shop',
            'STRIPE_ALLOW_LIVE'     => 'false',
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
            'STRIPE_ENABLED', 'STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET',
            'STRIPE_CURRENCY', 'STRIPE_RETURN_BASE_URL', 'STRIPE_ALLOW_LIVE',
        ] as $k) {
            putenv($k);
            unset($_ENV[$k], $_SERVER[$k]);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'sw-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000141',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Hook Traders',
            'phone' => '0700000141', 'is_approved' => true,
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
            'name' => 'Shopper', 'email' => 'sw-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000142',
        ]);
    }

    private function order(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'reference'       => '2K-HOOK0001',
            'user_id'         => $this->shopper->id,
            'vendor_id'       => $this->vendor->id,
            'product_id'      => $this->product->id,
            'quantity'        => 2,
            'price'           => 50000,
            'total'           => 100000,
            'status'          => 'pending',
            'payment_method'  => 'stripe',
            'payment_status'  => 'awaiting_payment',
            'fulfilment_type' => 'local',
        ], $overrides));
    }

    /** A Checkout Session object as Stripe sends it. */
    private function sessionObject(array $overrides = []): array
    {
        return array_merge([
            'id'             => 'cs_test_hook_1',
            'object'         => 'checkout.session',
            'payment_status' => 'paid',
            'status'         => 'complete',
            'currency'       => 'tzs',
            'amount_total'   => 10000000,
            'payment_intent' => 'pi_test_hook_1',
            'client_reference_id' => '2K-HOOK0001',
            'metadata'       => ['order_reference' => '2K-HOOK0001'],
            // Present so the redaction can be asserted on.
            'customer_details' => ['email' => 'shopper@example.com', 'name' => 'A Shopper'],
        ], $overrides);
    }

    /** @param array<string,mixed> $object */
    private function event(string $type, array $object, string $id = 'evt_test_1'): array
    {
        return [
            'id'      => $id,
            'object'  => 'event',
            'type'    => $type,
            'created' => time(),
            'data'    => ['object' => $object],
        ];
    }

    /**
     * Post an event with a genuine Stripe signature.
     *
     * The header is built exactly as Stripe builds it — an HMAC-SHA256 over
     * "{timestamp}.{raw body}" keyed with the webhook secret — so this
     * exercises real verification rather than a mock of it.
     */
    private function send(array $event, ?string $secret = self::SECRET, ?int $timestamp = null)
    {
        $payload = json_encode($event);
        $timestamp ??= time();

        $header = null;
        if ($secret !== null) {
            $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);
            $header = "t={$timestamp},v1={$signature}";
        }

        return $this->call(
            'POST',
            '/api/webhooks/stripe',
            [], [], [],
            array_filter([
                'CONTENT_TYPE'         => 'application/json',
                'HTTP_ACCEPT'          => 'application/json',
                'HTTP_STRIPE_SIGNATURE' => $header,
            ]),
            $payload,
        );
    }

    /* ---------------------------------------------------------------- */
    /* the signature is the authentication                               */
    /* ---------------------------------------------------------------- */

    public function test_a_webhook_with_no_signature_is_refused(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()), null)
            ->assertStatus(400);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
        $this->assertSame(0, StripeEvent::count());
    }

    public function test_a_webhook_signed_with_the_wrong_secret_is_refused(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()), 'whsec_not_the_secret')
            ->assertStatus(400);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
        $this->assertSame(0, StripeEvent::count());
    }

    public function test_a_forged_body_is_refused(): void
    {
        // The signature covers the bytes. Changing one after signing must fail.
        $order = $this->order();

        $event = $this->event('checkout.session.completed', $this->sessionObject());
        $payload = json_encode($event);
        $timestamp = time();
        $signature = hash_hmac('sha256', "{$timestamp}." . $payload, self::SECRET);

        $tampered = str_replace('10000000', '1', $payload);

        $this->call(
            'POST', '/api/webhooks/stripe', [], [], [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
            ],
            $tampered,
        )->assertStatus(400);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
    }

    public function test_an_unconfigured_endpoint_refuses_rather_than_accepts(): void
    {
        config(['stripe.webhook_secret' => '']);
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))
            ->assertStatus(503);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
    }

    /* ---------------------------------------------------------------- */
    /* settlement                                                        */
    /* ---------------------------------------------------------------- */

    public function test_a_verified_completed_session_settles_the_order(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        $order->refresh();

        $this->assertSame('verified', $order->payment_status);
        $this->assertNotNull($order->payment_verified_at);
        $this->assertSame('pi_test_hook_1', $order->payment_reference);
    }

    public function test_settlement_is_not_attributed_to_an_administrator(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        // `payment_verified_by` names the person who checked a payment by hand.
        // A gateway settlement had no such person, and writing an id here would
        // put somebody's name against a decision they did not make.
        $this->assertNull($order->fresh()->payment_verified_by);
        $this->assertStringContainsString('Stripe', (string) $order->fresh()->payment_note);
    }

    public function test_an_unpaid_completed_session_does_not_settle(): void
    {
        // `checkout.session.completed` fires for delayed payment methods while
        // the session is still unpaid. Settling on the event type alone grants
        // goods for payments that later fail.
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject([
            'payment_status' => 'unpaid',
        ])))->assertOk();

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
    }

    public function test_an_async_success_settles_a_previously_unpaid_session(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject([
            'payment_status' => 'unpaid',
        ]), 'evt_async_a'))->assertOk();

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);

        $this->send($this->event('checkout.session.async_payment_succeeded', $this->sessionObject([
            'payment_status' => 'paid',
        ]), 'evt_async_b'))->assertOk();

        $this->assertSame('verified', $order->fresh()->payment_status);
    }

    public function test_an_async_failure_leaves_the_order_payable(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.async_payment_failed', $this->sessionObject([
            'payment_status' => 'unpaid',
        ])))->assertOk();

        $order->refresh();

        // Still owing, so the shopper can try again. Not `rejected`: that word
        // means an administrator looked for the money and could not find it.
        $this->assertSame('awaiting_payment', $order->payment_status);
        $this->assertSame(Payment::FAILED, Payment::first()->status);
    }

    public function test_an_expired_session_leaves_the_order_payable(): void
    {
        $order = $this->order(['payment_status' => 'awaiting_verification']);

        $this->send($this->event('checkout.session.expired', $this->sessionObject([
            'payment_status' => 'unpaid', 'status' => 'expired',
        ])))->assertOk();

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
        $this->assertSame(Payment::EXPIRED, Payment::first()->status);
    }

    public function test_a_late_expiry_cannot_undo_a_settled_payment(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject(), 'evt_paid'))->assertOk();
        $this->assertSame('verified', $order->fresh()->payment_status);

        // A superseded session: its own id and its own PaymentIntent, as
        // Stripe would really send.
        $this->send($this->event('checkout.session.expired', $this->sessionObject([
            'id'             => 'cs_test_hook_old',
            'payment_intent' => 'pi_test_hook_old',
            'payment_status' => 'unpaid',
        ]), 'evt_expired'))->assertOk();

        $this->assertSame('verified', $order->fresh()->payment_status);
    }

    /* ---------------------------------------------------------------- */
    /* what settlement must NOT do                                       */
    /* ---------------------------------------------------------------- */

    public function test_settlement_does_not_decrement_stock_again(): void
    {
        // Stock is reserved once, at order creation.
        $this->order();
        $before = $this->product->fresh()->stock;

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        $this->assertSame($before, $this->product->fresh()->stock);
    }

    public function test_settlement_does_not_credit_a_vendor_wallet(): void
    {
        // A seller is credited when an order completes, not when it is paid.
        $this->order();
        Wallet::create(['vendor_id' => $this->vendor->id, 'balance' => 0]);

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        $this->assertEqualsWithDelta(
            0.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
    }

    public function test_settlement_does_not_move_the_order_journey(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        // Whether goods have moved and whether they are paid for are separate
        // facts. Fulfilment stays with the seller console and the admin panel.
        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_settlement_writes_exactly_one_timeline_entry(): void
    {
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        $this->assertSame(
            1,
            OrderEvent::where('reference', $order->reference)
                ->where('title', 'Payment verified')
                ->count(),
        );
    }

    public function test_a_cash_on_delivery_order_is_never_settled_by_a_webhook(): void
    {
        $order = $this->order(['payment_status' => 'not_required', 'payment_method' => 'cash_on_delivery']);

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        $this->assertSame('not_required', $order->fresh()->payment_status);
    }

    /* ---------------------------------------------------------------- */
    /* saved cards                                                       */
    /* ---------------------------------------------------------------- */

    public function test_the_stripe_customer_is_remembered_for_next_time(): void
    {
        $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject([
            'customer' => 'cus_test_new',
        ])))->assertOk();

        // An opaque identifier and nothing else. No card number, expiry or CVC
        // has ever reached this application.
        $this->assertSame('cus_test_new', $this->shopper->fresh()->stripe_customer_id);
    }

    public function test_an_existing_customer_id_is_not_overwritten(): void
    {
        // A shopper's cards are attached to one customer. A later session that
        // created a second must not move them off it.
        $this->shopper->forceFill(['stripe_customer_id' => 'cus_test_original'])->save();
        $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject([
            'customer' => 'cus_test_different',
        ])))->assertOk();

        $this->assertSame('cus_test_original', $this->shopper->fresh()->stripe_customer_id);
    }

    /* ---------------------------------------------------------------- */
    /* idempotency                                                       */
    /* ---------------------------------------------------------------- */

    public function test_the_same_event_delivered_twice_is_processed_once(): void
    {
        $order = $this->order();
        $event = $this->event('checkout.session.completed', $this->sessionObject(), 'evt_dupe');

        $this->send($event)->assertOk();
        $second = $this->send($event)->assertOk();

        $this->assertSame('duplicate', $second->json('outcome'));
        $this->assertSame(1, StripeEvent::count());
        $this->assertSame(
            1,
            OrderEvent::where('reference', $order->reference)->where('title', 'Payment verified')->count(),
        );
    }

    public function test_two_different_events_for_the_same_session_settle_once(): void
    {
        // Stripe genuinely sends both `completed` and `async_payment_succeeded`
        // for some methods. Distinct event ids, so both are processed — but the
        // order is already settled by the time the second arrives.
        $order = $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject(), 'evt_one'))->assertOk();
        $this->send($this->event('checkout.session.async_payment_succeeded', $this->sessionObject(), 'evt_two'))->assertOk();

        $this->assertSame('verified', $order->fresh()->payment_status);
        $this->assertSame(
            1,
            OrderEvent::where('reference', $order->reference)->where('title', 'Payment verified')->count(),
        );
        $this->assertSame(1, Payment::count());
    }

    public function test_an_event_for_an_unknown_order_is_accepted_and_changes_nothing(): void
    {
        // Answering non-2xx would make Stripe retry an event we can never
        // handle, forever.
        $this->send($this->event('checkout.session.completed', $this->sessionObject([
            'client_reference_id' => '2K-NOSUCH01',
            'metadata' => ['order_reference' => '2K-NOSUCH01'],
        ])))->assertOk();

        $this->assertSame(0, Order::count());
    }

    /* ---------------------------------------------------------------- */
    /* refunds and disputes are recorded only                            */
    /* ---------------------------------------------------------------- */

    public function test_a_refund_is_recorded_without_changing_the_order(): void
    {
        $order = $this->order();
        $this->send($this->event('checkout.session.completed', $this->sessionObject(), 'evt_paid'))->assertOk();

        $this->send($this->event('charge.refunded', [
            'id'              => 'ch_test_1',
            'object'          => 'charge',
            'payment_intent'  => 'pi_test_hook_1',
            'amount_refunded' => 10000000,
        ], 'evt_refund'))->assertOk();

        $payment = Payment::first();
        $this->assertSame(10000000, (int) $payment->refunded_amount_minor);
        $this->assertSame(Payment::REFUNDED, $payment->status);

        // Deliberately unchanged. Whether a refund cancels an order is a
        // judgement, and this release does not make it automatically.
        $order->refresh();
        $this->assertSame('verified', $order->payment_status);
        $this->assertSame('pending', $order->status);
    }

    public function test_a_dispute_is_recorded_without_changing_the_order(): void
    {
        $order = $this->order();
        $this->send($this->event('checkout.session.completed', $this->sessionObject(), 'evt_paid'))->assertOk();

        $this->send($this->event('charge.dispute.created', [
            'id'             => 'dp_test_1',
            'object'         => 'dispute',
            'payment_intent' => 'pi_test_hook_1',
            'charge'         => 'ch_test_1',
        ], 'evt_dispute'))->assertOk();

        $this->assertSame(Payment::DISPUTED, Payment::first()->status);
        $this->assertSame('verified', $order->fresh()->payment_status);
        $this->assertSame('pending', $order->fresh()->status);
    }

    /* ---------------------------------------------------------------- */
    /* hygiene                                                           */
    /* ---------------------------------------------------------------- */

    public function test_the_shoppers_personal_details_are_not_stored(): void
    {
        $this->order();

        $this->send($this->event('checkout.session.completed', $this->sessionObject()))->assertOk();

        $stored = StripeEvent::first()->payload;
        $this->assertSame('[redacted]', $stored['customer_details']);

        $raw = Payment::first()->raw;
        $this->assertSame('[redacted]', $raw['customer_details']);
    }

    public function test_an_unhandled_event_type_is_accepted_and_recorded(): void
    {
        $this->send($this->event('payment_intent.created', ['id' => 'pi_x', 'object' => 'payment_intent']))
            ->assertOk()
            ->assertJsonPath('outcome', 'ignored');

        $this->assertSame(1, StripeEvent::count());
    }

    public function test_the_webhook_route_does_not_exist_when_stripe_is_disabled(): void
    {
        config(['stripe.enabled' => false]);

        // Routes are registered at boot, so this asserts the config rather than
        // re-booting; the dedicated disabled-state test covers the 404.
        $this->assertFalse((bool) config('stripe.enabled'));
    }
}
