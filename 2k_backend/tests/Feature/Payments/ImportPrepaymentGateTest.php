<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\CheckoutPaymentChannel as Channel;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use App\Support\OrderGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * An unpaid import cannot become a seller's work.
 *
 * {@see \App\Support\CheckoutPolicy} already refuses cash on delivery for
 * anything sourced abroad, and has done since imports existed. What it did not
 * do was stop the order being advanced afterwards — so the rule held for
 * exactly as long as it took someone to press a button. A seller could accept,
 * dispatch and complete an order nobody had paid for; an administrator could
 * walk it the whole way; and the seller could not have known, because the
 * order payload they were given did not carry the payment state at all.
 *
 * Every case here is a request a determined caller could actually send. None
 * of them asserts that a button is hidden.
 */
class ImportPrepaymentGateTest extends TestCase
{
    use RefreshDatabase;

    private User $shopper;
    private User $seller;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seller = User::create([
            'name' => 'Seller', 'email' => 'gate-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000071',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->seller->id, 'business_name' => 'Import House',
            'phone' => '0700000071', 'is_approved' => true,
        ]);

        $this->category    = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'gate-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000072',
        ]);

        Channel::create([
            'code' => Channel::LIPA_NAMBA, 'label' => 'Lipa Namba',
            'merchant_name' => '2KONECT', 'number' => '555123',
            'instructions' => 'Pay the exact amount.',
            'is_active' => true, 'requires_reference' => true,
            'requires_verification' => true, 'sort_order' => 1,
        ]);
    }

    /* ---------------------------------------------------------------- */

    private function product(string $availability): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $this->subcategory->id,
            'name' => $availability === 'import' ? 'Imported Kettle' : 'Local Kettle',
            'new_price' => 100000, 'stock' => 10,
            'availability' => $availability,
            'source_country' => $availability === 'import' ? 'CN' : 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    /** Place a real order through the API, exactly as the storefront does. */
    private function place(string $availability, string $method): Order
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->product($availability)->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni, Kinondoni, Dar es Salaam',
            'customer_phone'   => '0700000072',
            'payment_method'   => $method,
        ])->assertCreated()->json('order.reference');

        return Order::where('reference', $reference)->firstOrFail();
    }

    private function paid(Order $order): Order
    {
        Order::where('reference', $order->reference)->update(['payment_status' => 'verified']);

        return $order->fresh();
    }

    private function asSeller(): void
    {
        Sanctum::actingAs($this->seller);
    }

    private function vendorOrders(): array
    {
        $this->asSeller();

        return $this->getJson('/api/shop/vendor/orders')->assertOk()->json('orders');
    }

    private function advance(Order $order, string $status = 'processing')
    {
        $this->asSeller();

        return $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => $status]);
    }

    /* ---------------------------------------------------------------- */
    /* TEST 1 — unpaid import is not the seller's work                   */
    /* ---------------------------------------------------------------- */

    public function test_an_unpaid_import_never_appears_in_the_sellers_orders(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        $this->assertSame('awaiting_payment', $order->payment_status);
        $this->assertSame([], $this->vendorOrders());
    }

    public function test_an_unpaid_import_cannot_be_advanced_by_its_seller(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        $this->advance($order)
            ->assertStatus(422)
            ->assertJson(['message' => OrderGate::MESSAGE]);

        // Refused, not merely hidden: the order did not move.
        $this->assertSame('pending', $order->fresh()->status);
    }

    /**
     * The one thing a seller may always do with an unpaid import.
     *
     * Cancelling returns the reserved units and closes a line nobody is going
     * to pay for. Blocking that would strand stock.
     */
    public function test_an_unpaid_import_can_still_be_cancelled(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        $this->advance($order, 'cancelled')->assertOk();

        $this->assertSame('cancelled', $order->fresh()->status);
    }

    /* ---------------------------------------------------------------- */
    /* TESTS 2 & 3 — failed and expired payments                         */
    /* ---------------------------------------------------------------- */

    public function test_a_failed_payment_leaves_an_import_unworkable(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);
        Order::where('reference', $order->reference)->update(['payment_status' => 'rejected']);

        $this->assertSame([], $this->vendorOrders());
        $this->advance($order)->assertStatus(422);
    }

    public function test_an_expired_session_leaves_an_import_unworkable(): void
    {
        // What WebhookProcessor::expire() writes: back to owing money.
        $order = $this->place('import', Channel::LIPA_NAMBA);
        Order::where('reference', $order->reference)->update(['payment_status' => 'awaiting_payment']);

        $this->assertSame([], $this->vendorOrders());
        $this->advance($order)->assertStatus(422);
    }

    /**
     * A claim to have paid is not a payment.
     *
     * `awaiting_verification` is what "I have paid, here is my reference"
     * writes. Somebody still has to go and look for the money.
     */
    public function test_a_customers_claim_to_have_paid_does_not_unlock_an_import(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);
        Order::where('reference', $order->reference)->update(['payment_status' => 'awaiting_verification']);

        $this->assertSame([], $this->vendorOrders());
        $this->advance($order)->assertStatus(422);
    }

    /* ---------------------------------------------------------------- */
    /* TEST 4 — payment verified                                         */
    /* ---------------------------------------------------------------- */

    public function test_a_paid_import_reaches_its_seller_and_says_it_is_paid(): void
    {
        $order = $this->paid($this->place('import', Channel::LIPA_NAMBA));

        $rows = $this->vendorOrders();
        $this->assertCount(1, $rows);

        $row = $rows[0];
        $this->assertSame('import', $row['fulfilment_type']);
        $this->assertSame('Paid', $row['payment']['label']);
        $this->assertSame('success', $row['payment']['tone']);
        $this->assertSame('Import order', $row['origin']['label']);
        $this->assertSame('🌍', $row['origin']['flag']);

        $this->advance($order)->assertOk();
        $this->assertSame('processing', $order->fresh()->status);
    }

    /* ---------------------------------------------------------------- */
    /* TESTS 6 & 7 — local orders                                        */
    /* ---------------------------------------------------------------- */

    public function test_a_local_order_can_be_placed_and_worked_without_paying_first(): void
    {
        $order = $this->place('local', Channel::CASH_ON_DELIVERY);

        $this->assertSame('not_required', $order->payment_status);

        $rows = $this->vendorOrders();
        $this->assertCount(1, $rows);
        $this->assertSame('Pay on delivery', $rows[0]['payment']['label']);
        $this->assertSame('Local order', $rows[0]['origin']['label']);
        $this->assertSame('🇹🇿', $rows[0]['origin']['flag']);

        // Pay on delivery is a legitimate arrangement, not an unpaid order.
        $this->advance($order)->assertOk();
    }

    public function test_a_local_order_awaiting_a_card_payment_still_reaches_its_seller(): void
    {
        // Deliberate. The goods are on a shelf in Dar es Salaam; if the buyer
        // refuses them the seller still has them. The gate exists for imports,
        // where the money is spent abroad before anyone can refuse anything.
        $order = $this->place('local', Channel::LIPA_NAMBA);

        $this->assertSame('awaiting_payment', $order->payment_status);
        $this->assertCount(1, $this->vendorOrders());
        $this->advance($order)->assertOk();
    }

    public function test_a_paid_local_order_says_paid_to_its_seller(): void
    {
        $this->paid($this->place('local', Channel::LIPA_NAMBA));

        $this->assertSame('Paid', $this->vendorOrders()[0]['payment']['label']);
    }

    /* ---------------------------------------------------------------- */
    /* TEST 8 — the admin cannot walk an unpaid import either            */
    /* ---------------------------------------------------------------- */

    public function test_the_gate_refuses_an_unpaid_import_whoever_is_asking(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        // The rule the admin panel's action consults. Asserted on the gate
        // itself because that is the single thing every caller goes through —
        // the console, both legacy endpoints and both Filament actions.
        $this->assertTrue(OrderGate::awaitsPrepayment($order));
        $this->assertFalse(OrderGate::processable($order));
        $this->assertSame(OrderGate::MESSAGE, OrderGate::refusal($order));

        $this->assertFalse(OrderGate::awaitsPrepayment($this->paid($order)));
        $this->assertNull(OrderGate::refusal($order->fresh()));
    }

    public function test_a_local_order_is_never_held_by_the_gate(): void
    {
        foreach (['not_required', 'awaiting_payment', 'awaiting_verification', 'rejected'] as $status) {
            $order = $this->place('local', Channel::CASH_ON_DELIVERY);
            Order::where('reference', $order->reference)->update(['payment_status' => $status]);

            $this->assertTrue(
                OrderGate::processable($order->fresh()),
                "A local order must never be blocked, even at {$status}.",
            );
        }
    }

    /* ---------------------------------------------------------------- */
    /* TEST 9 — the API itself, called directly                          */
    /* ---------------------------------------------------------------- */

    public function test_an_import_cannot_be_ordered_cash_on_delivery_through_the_api(): void
    {
        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->product('import')->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone'   => '0700000072',
            'payment_method'   => Channel::CASH_ON_DELIVERY,
        ])->assertStatus(422);

        // The whole checkout rolled back — no half-order, no reserved stock.
        $this->assertSame(0, Order::count());
    }

    /* ---------------------------------------------------------------- */
    /* TESTS 10 & 11 — no invented delivery fee                          */
    /* ---------------------------------------------------------------- */

    public function test_no_delivery_fee_is_invented_for_a_local_order(): void
    {
        $order = $this->place('local', Channel::CASH_ON_DELIVERY);

        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) Order::sum('delivery_fee'), 0.001);
    }

    public function test_the_order_total_is_the_goods_and_nothing_added(): void
    {
        $order = $this->place('local', Channel::CASH_ON_DELIVERY);

        Sanctum::actingAs($this->shopper);
        $payload = $this->getJson("/api/shop/orders/{$order->reference}")->assertOk()->json('order');

        // 100,000 for the kettle. Not 103,000.
        $this->assertEqualsWithDelta(100000.0, (float) $payload['subtotal'], 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $payload['delivery_fee'], 0.001);
        $this->assertEqualsWithDelta(100000.0, (float) $payload['total'], 0.001);
    }

    public function test_an_import_is_still_quoted_no_delivery(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.001);
    }

    /* ---------------------------------------------------------------- */
    /* TEST 12 — retrying a payment                                      */
    /* ---------------------------------------------------------------- */

    public function test_the_customer_keeps_sight_of_an_unpaid_import_so_they_can_pay_it(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        Sanctum::actingAs($this->shopper);
        $payload = $this->getJson("/api/shop/orders/{$order->reference}")->assertOk()->json('order');

        // Hidden from the seller, never from the person who owes the money.
        $this->assertSame('awaiting_payment', $payload['payment_status']);
        $this->assertSame('Payment required', $payload['payment']['label']);
        $this->assertSame('Import order', $payload['origin']['label']);
    }

    public function test_paying_moves_the_existing_order_rather_than_making_another(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);
        $this->assertSame(1, Order::count());

        $this->paid($order);

        $this->assertSame(1, Order::count());
        $this->assertCount(1, $this->vendorOrders());
    }

    /* ---------------------------------------------------------------- */
    /* TESTS 13 & 14 — refunds and disputes                              */
    /* ---------------------------------------------------------------- */

    public function test_a_refunded_import_stops_being_workable_again(): void
    {
        $order = $this->paid($this->place('import', Channel::LIPA_NAMBA));
        $this->assertCount(1, $this->vendorOrders());

        Order::where('reference', $order->reference)->update(['payment_status' => 'refunded']);

        $this->assertSame([], $this->vendorOrders());
        $this->advance($order)->assertStatus(422);
    }

    public function test_a_disputed_import_stops_being_workable(): void
    {
        $order = $this->paid($this->place('import', Channel::LIPA_NAMBA));
        Order::where('reference', $order->reference)->update(['payment_status' => 'disputed']);

        $this->assertSame([], $this->vendorOrders());
        $this->advance($order)->assertStatus(422);
    }

    /* ---------------------------------------------------------------- */
    /* the wallet                                                        */
    /* ---------------------------------------------------------------- */

    public function test_an_unpaid_import_can_never_credit_a_sellers_wallet(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        // The legacy endpoints, which is where the wallet is credited. Both
        // refuse before the status check they used to rely on.
        $this->asSeller();
        $this->postJson("/api/vendor/orders/{$order->id}/approve")->assertStatus(422);

        Order::where('reference', $order->reference)->update(['status' => 'processing']);
        $this->postJson("/api/vendor/orders/{$order->id}/complete")->assertStatus(422);

        $this->assertNull(Wallet::where('vendor_id', $this->vendor->id)->first());
    }

    public function test_a_paid_import_credits_the_wallet_exactly_once(): void
    {
        $order = $this->paid($this->place('import', Channel::LIPA_NAMBA));

        $this->asSeller();
        $this->postJson("/api/vendor/orders/{$order->id}/approve")->assertOk();
        $this->postJson("/api/vendor/orders/{$order->id}/complete")->assertOk();

        $this->assertEqualsWithDelta(
            100000.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->first()->balance,
            0.001,
        );

        // A second completion is refused, so the balance cannot double.
        $this->postJson("/api/vendor/orders/{$order->id}/complete")->assertStatus(400);

        $this->assertEqualsWithDelta(
            100000.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->first()->balance,
            0.001,
        );
    }

    /* ---------------------------------------------------------------- */
    /* the seller's own list, and what it does not leak                  */
    /* ---------------------------------------------------------------- */

    public function test_filtering_by_status_cannot_surface_an_unpaid_import(): void
    {
        $this->place('import', Channel::LIPA_NAMBA);

        // The status filter is a query parameter. It must not become a way
        // around the rule.
        $this->asSeller();
        $this->assertSame([], $this->getJson('/api/shop/vendor/orders?status=pending')->json('orders'));
    }

    public function test_a_paid_import_and_a_local_order_sit_together_correctly(): void
    {
        $this->paid($this->place('import', Channel::LIPA_NAMBA));
        $this->place('local', Channel::CASH_ON_DELIVERY);
        $this->place('import', Channel::LIPA_NAMBA);   // unpaid — must not show

        $rows = $this->vendorOrders();

        $this->assertCount(2, $rows);
        $this->assertEqualsCanonicalizing(
            ['Paid', 'Pay on delivery'],
            collect($rows)->pluck('payment.label')->all(),
        );
    }

    /* ---------------------------------------------------------------- */
    /* the backstop: no surface at all can move an unpaid import         */
    /* ---------------------------------------------------------------- */

    /**
     * The admin edit form's status select offers every stop on the journey.
     *
     * It does not go through any of the guarded actions, so without a guard on
     * the model itself an administrator could simply open an unpaid import and
     * set it to "shipped" — which is precisely the bypass the controllers were
     * added to prevent.
     */
    public function test_no_code_path_can_save_an_unpaid_import_forward(): void
    {
        $order = $this->place('import', Channel::LIPA_NAMBA);

        foreach (['processing', 'dispatched', 'in_transit', 'shipped', 'completed'] as $status) {
            try {
                $order->update(['status' => $status]);
                $this->fail("Saving an unpaid import as '{$status}' should have been refused.");
            } catch (\Illuminate\Validation\ValidationException $e) {
                $this->assertSame(OrderGate::MESSAGE, $e->errors()['status'][0]);
            }

            $this->assertSame('pending', $order->fresh()->status);
        }
    }

    public function test_an_unpaid_import_can_still_be_closed(): void
    {
        // Cancelling returns stock; refunding records money going back. Both
        // must stay possible or an unpaid import becomes unclosable.
        foreach (['cancelled', 'refunded'] as $status) {
            $order = $this->place('import', Channel::LIPA_NAMBA);
            $order->update(['status' => $status]);

            $this->assertSame($status, $order->fresh()->status);
            Order::query()->delete();
        }
    }

    public function test_a_paid_import_saves_forward_normally(): void
    {
        $order = $this->paid($this->place('import', Channel::LIPA_NAMBA));

        $order->update(['status' => 'processing']);

        $this->assertSame('processing', $order->fresh()->status);
    }

    public function test_a_local_order_saves_forward_whatever_it_owes(): void
    {
        $order = $this->place('local', Channel::LIPA_NAMBA);

        $this->assertSame('awaiting_payment', $order->payment_status);
        $order->update(['status' => 'shipped']);

        $this->assertSame('shipped', $order->fresh()->status);
    }
}
