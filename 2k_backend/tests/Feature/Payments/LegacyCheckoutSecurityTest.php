<?php

namespace Tests\Feature\Payments;

use App\Filament\Resources\OrderResource;
use App\Models\Category;
use App\Models\CheckoutPaymentChannel as Channel;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\PaymentType;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorPaymentOption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The legacy checkout, held to the same rules as the storefront one.
 *
 * It used to have its own. Orders created through it carried neither
 * `fulfilment_type` nor `payment_status`, so they took the column defaults —
 * `local`, and `not_required`. `not_required` means cash on delivery. An
 * imported product bought here was therefore an import that owed nothing,
 * which is exactly what CheckoutPolicy exists to make impossible.
 *
 * It also took the order reference from the request body and defaulted it to
 * the literal string "ManualConfirm". Since settlement is applied to a whole
 * reference group at once, every order that ever went through it without a
 * reference joined one shared, cross-account group.
 */
class LegacyCheckoutSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $shopper;
    private User $other;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;

    public function createApplication()
    {
        foreach (['AZAMPAY_ENABLED' => 'true'] as $key => $value) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        return parent::createApplication();
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        putenv('AZAMPAY_ENABLED');
        unset($_ENV['AZAMPAY_ENABLED'], $_SERVER['AZAMPAY_ENABLED']);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'lg-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000071',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Legacy Traders',
            'phone' => '0700000071', 'is_approved' => true,
        ]);

        $this->category = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'lg-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000072',
        ]);

        $this->other = User::create([
            'name' => 'Someone Else', 'email' => 'lg-other@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000073',
        ]);

        Channel::create([
            'code' => Channel::LIPA_NAMBA, 'label' => 'Lipa Namba',
            'merchant_name' => '2KONECT', 'number' => '555123',
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

    private function confirmManual(array $body, ?User $as = null)
    {
        Sanctum::actingAs($as ?? $this->shopper);

        return $this->postJson('/api/checkout/confirm-manual', $body);
    }

    /* ---------------------------------------------------------------- */
    /* the import prepayment rule                                        */
    /* ---------------------------------------------------------------- */

    public function test_an_imported_product_bought_here_still_owes_money(): void
    {
        $product = $this->product('Imported Phone', 'import');

        $this->confirmManual([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'total' => 100000,
        ])->assertOk();

        $order = Order::first();

        // The defect: with no `payment_status` written, the column defaulted to
        // `not_required` — an imported order that owed nothing, which is cash
        // on delivery by another name.
        $this->assertNotSame('not_required', $order->payment_status);
        $this->assertSame('awaiting_payment', $order->payment_status);
        $this->assertSame('import', $order->fulfilment_type);
    }

    public function test_a_local_product_bought_here_also_records_that_money_is_owed(): void
    {
        $product = $this->product('Local Kettle', 'local');

        $this->confirmManual([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk();

        $order = Order::first();

        $this->assertSame('awaiting_payment', $order->payment_status);
        $this->assertSame('local', $order->fulfilment_type);
    }

    public function test_the_storefront_rule_is_unchanged_by_any_of_this(): void
    {
        // The canonical path must behave exactly as it did before.
        $product = $this->product('Imported Phone', 'import');

        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items'            => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery_address' => 'Msasani, Dar es Salaam',
            'customer_phone'   => '0700000072',
            'payment_method'   => 'cash_on_delivery',
        ])->assertStatus(422);

        $this->assertSame(0, Order::count());
    }

    /* ---------------------------------------------------------------- */
    /* the reference                                                     */
    /* ---------------------------------------------------------------- */

    public function test_a_caller_supplied_reference_is_ignored(): void
    {
        $product = $this->product('Local Kettle', 'local');

        $this->confirmManual([
            'items'     => [['product_id' => $product->id, 'quantity' => 1]],
            'reference' => 'ManualConfirm',
        ])->assertOk();

        $reference = Order::first()->reference;

        $this->assertNotSame('ManualConfirm', $reference);
        $this->assertMatchesRegularExpression('/^2K-[A-Z0-9]{8}$/', $reference);
    }

    public function test_two_customers_cannot_be_placed_in_one_reference_group(): void
    {
        $product = $this->product('Local Kettle', 'local', 100000, 50);

        $this->confirmManual(['items' => [['product_id' => $product->id, 'quantity' => 1]]])
            ->assertOk();
        $victimReference = Order::where('user_id', $this->shopper->id)->value('reference');

        // The attack: name the victim's reference and join their group, so that
        // verifying either order settles both.
        $this->confirmManual([
            'items'     => [['product_id' => $product->id, 'quantity' => 1]],
            'reference' => $victimReference,
        ], $this->other)->assertOk();

        $attackerReference = Order::where('user_id', $this->other->id)->value('reference');

        $this->assertNotSame($victimReference, $attackerReference);
    }

    /* ---------------------------------------------------------------- */
    /* cross-account settlement                                          */
    /* ---------------------------------------------------------------- */

    public function test_submitting_a_payment_reference_cannot_reach_another_customers_order(): void
    {
        $product = $this->product('Local Kettle', 'local');

        // Historic data: two customers already sharing one reference, which is
        // what the old default produced. The fix has to hold for rows that are
        // already in the table, not only for new ones.
        $mine = Order::create([
            'reference' => '2K-SHARED01', 'user_id' => $this->shopper->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $product->id,
            'quantity' => 1, 'price' => 1000, 'total' => 1000, 'status' => 'pending',
            'payment_method' => 'lipa_namba', 'payment_status' => 'awaiting_payment',
        ]);

        $theirs = Order::create([
            'reference' => '2K-SHARED01', 'user_id' => $this->other->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $product->id,
            'quantity' => 1, 'price' => 5000000, 'total' => 5000000, 'status' => 'pending',
            'payment_method' => 'lipa_namba', 'payment_status' => 'awaiting_payment',
        ]);

        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders/2K-SHARED01/payment', [
            'payment_reference' => 'MPESA-XYZ-123',
        ])->assertOk();

        $this->assertSame('awaiting_verification', $mine->fresh()->payment_status);
        $this->assertSame('awaiting_payment', $theirs->fresh()->payment_status);
        $this->assertNull($theirs->fresh()->payment_reference);
    }

    public function test_verifying_a_payment_cannot_settle_another_customers_order(): void
    {
        $product = $this->product('Local Kettle', 'local');

        $mine = Order::create([
            'reference' => '2K-SHARED02', 'user_id' => $this->shopper->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $product->id,
            'quantity' => 1, 'price' => 1000, 'total' => 1000, 'status' => 'pending',
            'payment_method' => 'lipa_namba', 'payment_status' => 'awaiting_verification',
        ]);

        $theirs = Order::create([
            'reference' => '2K-SHARED02', 'user_id' => $this->other->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $product->id,
            'quantity' => 1, 'price' => 5000000, 'total' => 5000000, 'status' => 'pending',
            'payment_method' => 'lipa_namba', 'payment_status' => 'awaiting_verification',
        ]);

        // The admin action is a Filament table action rather than a route, so
        // the protected helper behind it is exercised directly.
        $settle = new ReflectionMethod(OrderResource::class, 'settlePayment');
        $settle->setAccessible(true);
        $settle->invoke(null, $mine, 'verified', 'Checked against the statement.');

        $this->assertSame('verified', $mine->fresh()->payment_status);
        $this->assertSame('awaiting_verification', $theirs->fresh()->payment_status);
    }

    /* ---------------------------------------------------------------- */
    /* pricing and stock                                                 */
    /* ---------------------------------------------------------------- */

    public function test_the_price_comes_from_the_resolver_not_the_products_headline(): void
    {
        $product = $this->product('Bulk Cable', 'local', 10000, 100);

        ProductPriceTier::create([
            'product_id' => $product->id, 'min_quantity' => 10,
            'max_quantity' => null, 'unit_price' => 7000,
        ]);

        $this->confirmManual([
            'items' => [['product_id' => $product->id, 'quantity' => 10]],
        ])->assertOk();

        $order = Order::first();

        // It used to read `$product->new_price` directly, so quantity tiers and
        // alternative offers were invisible and the customer was charged a
        // figure that is not on sale anywhere else on the site.
        $this->assertSame('7000.00', (string) $order->price);
        $this->assertSame('70000.00', (string) $order->total);
    }

    public function test_a_sold_out_local_product_is_refused(): void
    {
        $product = $this->product('Local Kettle', 'local', 100000, 0);

        $this->confirmManual([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(400);

        $this->assertSame(0, Order::count());
    }

    /* ---------------------------------------------------------------- */
    /* the vendor payout leak                                            */
    /* ---------------------------------------------------------------- */

    public function test_the_basket_preview_does_not_expose_a_sellers_payout_account(): void
    {
        $product = $this->product('Local Kettle', 'local');

        $type = PaymentType::create(['name' => 'Mobile Money']);
        $method = PaymentMethod::create(['payment_type_id' => $type->id, 'name' => 'M-Pesa']);

        VendorPaymentOption::create([
            'vendor_id'         => $this->vendor->id,
            'payment_type_id'   => $type->id,
            'payment_method_id' => $method->id,
            'account'           => '0754999888',
        ]);

        Sanctum::actingAs($this->shopper);

        $response = $this->postJson('/api/checkout/vendors', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertOk();

        // The seller's own banking detail has no bearing on how the customer
        // pays 2KONECT, and any signed-in shopper could read it.
        $this->assertStringNotContainsString('0754999888', $response->getContent());
        $this->assertStringNotContainsString('payment_options', $response->getContent());
    }
}
