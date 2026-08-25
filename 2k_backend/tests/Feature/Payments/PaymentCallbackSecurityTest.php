<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\PaymentCallback;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The AzamPay callback, treated as what it is: an unauthenticated stranger
 * making a claim about money.
 *
 * AzamPay publishes no callback signing mechanism — no signature, no HMAC, no
 * timestamp — so there is nothing to verify and no way to tell a genuine
 * callback from a forged one. Every test here is therefore a request an
 * attacker could actually send, and the claim under test is not "the gateway
 * is trusted" but "trusting it is never necessary".
 *
 * The four irreversible effects the old handler had are asserted absent
 * individually, because each one was independently exploitable.
 */
class PaymentCallbackSecurityTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-callback-secret-0123456789abcdef';
    private const EXTERNAL = 'utility-ref-abc-123';

    private User $shopper;
    private Vendor $vendor;
    private Product $product;

    /**
     * The routes only exist when the AzamPay surface is switched on, and it is
     * off by default. Set before the application boots, because routes are
     * registered during bootstrap.
     */
    public function createApplication()
    {
        $this->setEnv('AZAMPAY_ENABLED', 'true');
        $this->setEnv('AZAMPAY_CALLBACK_SECRET', self::SECRET);

        return parent::createApplication();
    }

    private function setEnv(string $key, string $value): void
    {
        putenv("$key=$value");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        foreach (['AZAMPAY_ENABLED', 'AZAMPAY_CALLBACK_SECRET'] as $key) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'cb-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000061',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Callback Traders',
            'phone' => '0700000061', 'is_approved' => true,
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
            'name' => 'Shopper', 'email' => 'cb-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000062',
        ]);
    }

    private function order(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'reference'       => '2K-CALLBK01',
            'user_id'         => $this->shopper->id,
            'vendor_id'       => $this->vendor->id,
            'product_id'      => $this->product->id,
            'quantity'        => 1,
            'price'           => 50000,
            'total'           => 50000,
            'status'          => 'pending',
            'payment_method'  => 'mobile_money',
            'payment_status'  => 'awaiting_payment',
            'external_id'     => self::EXTERNAL,
            'fulfilment_type' => 'local',
        ], $overrides));
    }

    /** @param array<string,mixed> $overrides */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'msisdn'            => '255700000062',
            'amount'            => '50000',
            'message'           => 'Payment received',
            'utilityref'        => self::EXTERNAL,
            'operator'          => 'Tigo',
            'reference'         => 'AZM-TXN-0001',
            'transactionstatus' => 'success',
            'submerchantAcc'    => '01723113',
        ], $overrides);
    }

    private function postCallback(array $payload, ?string $token = self::SECRET)
    {
        $path = '/api/v1/Checkout/Callback' . ($token !== null ? '/' . $token : '');

        return $this->postJson($path, $payload);
    }

    /* ---------------------------------------------------------------- */
    /* the gate                                                          */
    /* ---------------------------------------------------------------- */

    public function test_a_callback_with_no_token_is_refused_and_changes_nothing(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload(), null)->assertStatus(401);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
        $this->assertSame(0, PaymentCallback::count());
    }

    public function test_a_callback_with_the_wrong_token_is_refused(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload(), 'not-the-secret')->assertStatus(401);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
        $this->assertSame(0, PaymentCallback::count());
    }

    public function test_an_unconfigured_endpoint_refuses_everything_rather_than_allowing_it(): void
    {
        // Fails closed. "No secret configured" must never be read as "no check
        // required", which is how an endpoint ends up open in production after
        // somebody copies an env file.
        config(['azampay.callback_secret' => '']);

        $order = $this->order();

        $this->postCallback($this->payload())->assertStatus(503);

        $this->assertSame('awaiting_payment', $order->fresh()->payment_status);
    }

    public function test_the_token_is_also_accepted_as_a_header(): void
    {
        $this->order();

        $this->withHeader('X-Callback-Token', self::SECRET)
            ->postJson('/api/v1/Checkout/Callback', $this->payload())
            ->assertOk();
    }

    /* ---------------------------------------------------------------- */
    /* what a valid callback may and may not do                          */
    /* ---------------------------------------------------------------- */

    public function test_a_successful_callback_queues_the_payment_but_never_settles_it(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload())->assertOk();

        $order->refresh();

        // The furthest a callback may move an order: into the queue a human
        // works. `verified` is an administrator's word, not a gateway's.
        $this->assertSame('awaiting_verification', $order->payment_status);
        $this->assertNotSame('verified', $order->payment_status);
        $this->assertNull($order->payment_verified_at);
        $this->assertNull($order->payment_verified_by);
    }

    public function test_a_successful_callback_never_credits_a_vendor_wallet(): void
    {
        $this->order();
        Wallet::create(['vendor_id' => $this->vendor->id, 'balance' => 0]);

        $this->postCallback($this->payload())->assertOk();

        $this->assertEqualsWithDelta(
            0.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
    }

    public function test_a_successful_callback_never_decrements_stock(): void
    {
        // Stock is reserved once, when the order is created. The old handler
        // decremented the same units a second time here, so every mobile money
        // order sold twice as much as it shipped.
        $this->order();
        $before = $this->product->fresh()->stock;

        $this->postCallback($this->payload())->assertOk();

        $this->assertSame($before, $this->product->fresh()->stock);
    }

    public function test_a_successful_callback_never_moves_the_order_journey(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload())->assertOk();

        // It used to write `paid`, which is not a status this system has.
        // `OrderJourney::timeline()` cannot place it, so the buyer's tracking
        // screen rendered every step as still to come.
        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_a_successful_callback_never_triggers_fulfilment(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload())->assertOk();

        $order->refresh();
        $this->assertNotSame('processing', $order->status);
        $this->assertNotSame('shipped', $order->status);
        $this->assertNotSame('completed', $order->status);
    }

    /* ---------------------------------------------------------------- */
    /* idempotency                                                       */
    /* ---------------------------------------------------------------- */

    public function test_the_same_callback_delivered_twice_is_processed_once(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload())->assertOk();
        $second = $this->postCallback($this->payload())->assertOk();

        $this->assertSame('already_processed', $second->json('status'));
        $this->assertSame(1, PaymentCallback::count());
        $this->assertSame(
            1,
            OrderEvent::where('reference', $order->reference)
                ->where('title', 'Payment submitted')
                ->count(),
        );
    }

    public function test_a_replayed_callback_cannot_knock_a_settled_order_back_into_the_queue(): void
    {
        // The order has been checked by a person and confirmed. A callback
        // arriving afterwards — replayed, forged, or genuinely late — must not
        // undo that.
        $order = $this->order(['payment_status' => 'verified']);

        $this->postCallback($this->payload(['reference' => 'AZM-TXN-REPLAY']))->assertOk();

        $this->assertSame('verified', $order->fresh()->payment_status);
    }

    public function test_a_callback_cannot_put_a_cash_on_delivery_order_into_the_payment_queue(): void
    {
        $order = $this->order(['payment_status' => 'not_required', 'payment_method' => 'cash_on_delivery']);

        $this->postCallback($this->payload())->assertOk();

        $this->assertSame('not_required', $order->fresh()->payment_status);
    }

    /* ---------------------------------------------------------------- */
    /* everything else                                                   */
    /* ---------------------------------------------------------------- */

    public function test_a_callback_for_an_unknown_reference_writes_nothing(): void
    {
        $this->order();

        $this->postCallback($this->payload(['utilityref' => 'no-such-order']))
            ->assertStatus(404);

        // No row for a reference that means nothing to us, so an
        // unauthenticated caller cannot fill the table by guessing.
        $this->assertSame(0, PaymentCallback::count());
    }

    public function test_a_failed_attempt_is_recorded_and_leaves_the_order_payable(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload(['transactionstatus' => 'failed']))->assertOk();

        $order->refresh();

        // Still owing, so the customer can try again. Not moved to `rejected`:
        // in this system that means an administrator looked for the money and
        // could not find it, and a gateway is not entitled to say so.
        $this->assertSame('awaiting_payment', $order->payment_status);
        $this->assertSame('pending', $order->status);
        $this->assertSame(1, PaymentCallback::where('status', 'failed')->count());
    }

    public function test_the_payers_phone_number_is_not_stored_in_the_callback_record(): void
    {
        $this->order();

        $this->postCallback($this->payload())->assertOk();

        $stored = PaymentCallback::first()->payload;

        $this->assertSame('[redacted]', $stored['msisdn']);
        $this->assertSame('[redacted]', $stored['submerchantAcc']);
        // Everything not identifying a person is kept verbatim, because the
        // point of keeping it is to see what was actually sent.
        $this->assertSame('AZM-TXN-0001', $stored['reference']);
    }

    public function test_an_amount_that_does_not_match_the_order_is_flagged_to_the_verifier(): void
    {
        $order = $this->order();

        $this->postCallback($this->payload(['amount' => '5000']))->assertOk();

        $note = OrderEvent::where('reference', $order->reference)
            ->where('title', 'Payment submitted')
            ->value('note');

        $this->assertStringContainsString('does not match', $note);
        // Flagged, not enforced: the callback is not trusted enough to refuse
        // an order on, and a human is going to check the statement anyway.
        $this->assertSame('awaiting_verification', $order->fresh()->payment_status);
    }
}
