<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\CheckoutPaymentChannel as Channel;
use App\Models\DeliveryRequest;
use App\Models\Order;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The rule: anything 2KONECT has to buy abroad is paid for before it is bought.
 *
 * These tests go through the HTTP API rather than calling the policy directly,
 * because "the interface does not offer cash on delivery" is not the claim
 * being made. The claim is that the server refuses it — so every case here is
 * a request a determined caller could actually send.
 */
class InternationalPrepaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $shopper;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'pay-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000051',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Import House',
            'phone' => '0700000051', 'is_approved' => true,
        ]);

        $this->category    = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'pay-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000052',
        ]);

        // A configured, live till number.
        Channel::create([
            'code' => Channel::LIPA_NAMBA, 'label' => 'Lipa Namba',
            'merchant_name' => '2KONECT', 'number' => '555123',
            'instructions' => 'Pay the exact amount.',
            'is_active' => true, 'requires_reference' => true,
            'requires_verification' => true, 'sort_order' => 1,
        ]);
    }

    private function product(string $name, string $availability, float $price = 100000, int $stock = 10): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $this->subcategory->id, 'name' => $name,
            'new_price' => $price, 'stock' => $stock,
            'availability' => $availability,
            'source_country' => $availability === 'import' ? 'CN' : 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    private function checkout(array $items, string $method, array $extra = [])
    {
        Sanctum::actingAs($this->shopper);

        return $this->postJson('/api/shop/orders', array_merge([
            'items'            => $items,
            'delivery_address' => 'Msasani, Dar es Salaam',
            'customer_phone'   => '0700000052',
            'payment_method'   => $method,
        ], $extra));
    }

    /* ---------------------------------------------------------------- */
    /* the core refusal                                                  */
    /* ---------------------------------------------------------------- */

    public function test_an_imported_product_cannot_be_paid_cash_on_delivery(): void
    {
        $product = $this->product('Imported Phone', 'import');

        $response = $this->checkout(
            [['product_id' => $product->id, 'quantity' => 1]],
            'cash_on_delivery',
        );

        $response->assertStatus(422);
        $this->assertStringContainsString('Cash on Delivery is not available', $response->json('message'));

        // Nothing may survive the refusal.
        $this->assertSame(0, Order::count());
    }

    public function test_a_local_product_may_still_be_paid_cash_on_delivery(): void
    {
        $product = $this->product('Local Kettle', 'local');

        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], 'cash_on_delivery')
            ->assertStatus(201);

        $order = Order::first();
        $this->assertSame('cash_on_delivery', $order->payment_method);
        $this->assertSame('not_required', $order->payment_status);
    }

    public function test_a_mixed_basket_cannot_be_paid_cash_on_delivery(): void
    {
        $local  = $this->product('Local Kettle', 'local');
        $abroad = $this->product('Imported Phone', 'import');

        $response = $this->checkout([
            ['product_id' => $local->id, 'quantity' => 1],
            ['product_id' => $abroad->id, 'quantity' => 1],
        ], 'cash_on_delivery');

        $response->assertStatus(422);
        $this->assertStringContainsString('Cash on Delivery is not available', $response->json('message'));
        $this->assertSame(0, Order::count(), 'the local half must not slip through');
    }

    public function test_an_imported_product_can_be_paid_with_lipa_namba(): void
    {
        $product = $this->product('Imported Phone', 'import');

        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA)
            ->assertStatus(201);

        $order = Order::first();
        $this->assertSame(Channel::LIPA_NAMBA, $order->payment_method);
        $this->assertSame('awaiting_payment', $order->payment_status);
    }

    public function test_a_channel_that_is_switched_off_is_refused(): void
    {
        Channel::where('code', Channel::LIPA_NAMBA)->update(['is_active' => false]);

        $product = $this->product('Imported Phone', 'import');

        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA)
            ->assertStatus(422)
            ->assertJsonValidationErrors('payment_method');

        $this->assertSame(0, Order::count());
    }

    public function test_an_invented_payment_method_is_refused(): void
    {
        $product = $this->product('Imported Phone', 'import');

        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], 'free_of_charge')
            ->assertStatus(422)
            ->assertJsonValidationErrors('payment_method');
    }

    /* ---------------------------------------------------------------- */
    /* delivery is not attached at checkout                              */
    /* ---------------------------------------------------------------- */

    public function test_an_imported_order_is_charged_no_delivery_at_checkout(): void
    {
        $product = $this->product('Imported Phone', 'import');

        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA)
            ->assertStatus(201);

        $this->assertEquals(0, (float) Order::sum('delivery_fee'));
        $this->assertSame(0, DeliveryRequest::count(), 'no delivery may be arranged by checking out');
    }

    public function test_a_local_order_is_charged_no_delivery_fee_at_checkout(): void
    {
        $product = $this->product('Local Kettle', 'local');

        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], 'cash_on_delivery')
            ->assertStatus(201);

        // No fee, for any order. The flat TZS 3,000 that used to be added here
        // was a number rather than a price — what a rider's journey costs
        // depends on where the customer is, and none of that is known while
        // the basket is still on screen. The column is filled in later by the
        // delivery flow, once somebody knows the answer.
        $this->assertEquals(0, (float) Order::sum('delivery_fee'));
    }

    public function test_a_mixed_basket_is_charged_no_delivery_at_checkout(): void
    {
        $local  = $this->product('Local Kettle', 'local');
        $abroad = $this->product('Imported Phone', 'import');

        $this->checkout([
            ['product_id' => $local->id, 'quantity' => 1],
            ['product_id' => $abroad->id, 'quantity' => 1],
        ], Channel::LIPA_NAMBA)->assertStatus(201);

        $this->assertEquals(0, (float) Order::sum('delivery_fee'));
    }

    /* ---------------------------------------------------------------- */
    /* paying, and being believed only after a human looks               */
    /* ---------------------------------------------------------------- */

    public function test_submitting_a_reference_does_not_make_an_order_paid(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);

        $reference = Order::first()->reference;

        Sanctum::actingAs($this->shopper);
        $this->postJson("/api/shop/orders/{$reference}/payment", [
            'payment_reference' => 'QWE123456',
        ])->assertOk();

        $order = Order::first();
        $this->assertSame('awaiting_verification', $order->payment_status);
        $this->assertSame('QWE123456', $order->payment_reference);
        $this->assertNull($order->payment_verified_at);
        $this->assertNotSame('verified', $order->payment_status);
    }

    public function test_a_shopper_cannot_submit_a_payment_for_someone_elses_order(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);
        $reference = Order::first()->reference;

        $stranger = User::create([
            'name' => 'Stranger', 'email' => 'stranger@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000099',
        ]);

        Sanctum::actingAs($stranger);
        $this->postJson("/api/shop/orders/{$reference}/payment", [
            'payment_reference' => 'HACK1234',
        ])->assertStatus(404);

        $this->assertSame('awaiting_payment', Order::first()->payment_status);
    }

    public function test_there_is_no_customer_route_that_marks_a_payment_verified(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);
        $reference = Order::first()->reference;

        Sanctum::actingAs($this->shopper);

        // The obvious guesses, all of which must not exist.
        foreach ([
            "/api/shop/orders/{$reference}/payment/verify",
            "/api/shop/orders/{$reference}/verify",
        ] as $route) {
            $this->postJson($route, ['payment_status' => 'verified'])->assertStatus(404);
        }

        // And the submission route cannot be used to name a status.
        $this->postJson("/api/shop/orders/{$reference}/payment", [
            'payment_reference' => 'QWE123456',
            'payment_status'    => 'verified',
        ])->assertOk();

        $this->assertSame('awaiting_verification', Order::first()->payment_status);
    }

    public function test_a_cash_on_delivery_order_has_nothing_to_confirm(): void
    {
        $product = $this->product('Local Kettle', 'local');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], 'cash_on_delivery');
        $reference = Order::first()->reference;

        Sanctum::actingAs($this->shopper);
        $this->postJson("/api/shop/orders/{$reference}/payment", [
            'payment_reference' => 'QWE123456',
        ])->assertStatus(422);
    }

    /* ---------------------------------------------------------------- */
    /* what the storefront is told                                       */
    /* ---------------------------------------------------------------- */

    public function test_the_channel_list_hides_cash_on_delivery_for_an_import(): void
    {
        $response = $this->getJson('/api/shop/payment-channels?import=1')->assertOk();

        $this->assertTrue($response->json('requires_prepayment'));
        $this->assertFalse($response->json('cash_on_delivery'));
        $this->assertFalse($response->json('charges_delivery'));
        $this->assertSame(Channel::LIPA_NAMBA, $response->json('channels.0.code'));
        $this->assertSame('555123', $response->json('channels.0.number'));
    }

    public function test_the_channel_list_offers_cash_on_delivery_for_a_local_basket(): void
    {
        $response = $this->getJson('/api/shop/payment-channels')->assertOk();

        $this->assertFalse($response->json('requires_prepayment'));
        $this->assertTrue($response->json('cash_on_delivery'));
        $this->assertTrue($response->json('charges_delivery'));
    }

    public function test_an_inactive_channel_is_never_advertised(): void
    {
        Channel::where('code', Channel::LIPA_NAMBA)->update(['is_active' => false]);

        $this->getJson('/api/shop/payment-channels?import=1')
            ->assertOk()
            ->assertJsonCount(0, 'channels');
    }

    /* ---------------------------------------------------------------- */
    /* what an administrator does, and what it must not do               */
    /* ---------------------------------------------------------------- */

    /** Runs the real Filament action body, not a re-implementation of it. */
    private function adminAction(string $method, Order $order, ...$args): void
    {
        $admin = User::create([
            'name' => 'Admin', 'email' => 'admin-' . uniqid() . '@test.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000060',
        ]);
        $this->actingAs($admin);

        $reflection = new \ReflectionMethod(\App\Filament\Resources\OrderResource::class, $method);
        $reflection->setAccessible(true);
        $reflection->invoke(null, $order, ...$args);
    }

    public function test_verifying_a_payment_settles_it_and_records_who_did(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);
        $reference = Order::first()->reference;

        Sanctum::actingAs($this->shopper);
        $this->postJson("/api/shop/orders/{$reference}/payment", ['payment_reference' => 'QWE123456']);

        $this->adminAction('settlePayment', Order::first(), 'verified', 'Seen on the statement.');

        $order = Order::first();
        $this->assertSame('verified', $order->payment_status);
        $this->assertNotNull($order->payment_verified_at);
        $this->assertNotNull($order->payment_verified_by);
    }

    public function test_verifying_a_payment_does_not_add_a_delivery(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);

        Sanctum::actingAs($this->shopper);
        $this->postJson('/api/shop/orders/' . Order::first()->reference . '/payment', [
            'payment_reference' => 'QWE123456',
        ]);

        $this->adminAction('settlePayment', Order::first(), 'verified', null);

        // The whole point of separating them: paying for the goods buys the
        // goods, and nothing else.
        $this->assertEquals(0, (float) Order::sum('delivery_fee'));
        $this->assertSame(0, DeliveryRequest::count());
    }

    public function test_an_administrator_adds_delivery_separately_afterwards(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);

        $this->adminAction('attachDelivery', Order::first(), [
            'mode' => 'delivery', 'fee' => 8000, 'notes' => 'Delivery within Dar es Salaam.',
        ]);

        $this->assertEquals(8000, (float) Order::sum('delivery_fee'));

        $delivery = DeliveryRequest::first();
        $this->assertNotNull($delivery);
        $this->assertSame('delivery', $delivery->mode);
        $this->assertEquals(8000, (float) $delivery->fee);
        $this->assertSame('Delivery within Dar es Salaam.', $delivery->notes);
    }

    public function test_a_rejected_payment_is_not_paid_and_says_why(): void
    {
        $product = $this->product('Imported Phone', 'import');
        $this->checkout([['product_id' => $product->id, 'quantity' => 1]], Channel::LIPA_NAMBA);

        $this->adminAction('settlePayment', Order::first(), 'rejected', 'No such reference.');

        $order = Order::first();
        $this->assertSame('rejected', $order->payment_status);
        $this->assertNull($order->payment_verified_at);
        $this->assertSame('No such reference.', $order->payment_note);
    }
}
