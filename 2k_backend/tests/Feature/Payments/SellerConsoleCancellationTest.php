<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductVariant;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Support\OrderJourney;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The active seller console cancellation, across every shape stock can take.
 *
 * This path asked only "is it an import?" and then credited the offer or the
 * product. It never asked about a variant, so cancelling a combination made
 * two errors in one transaction: the units taken off the variant at checkout
 * were never returned, and the parent product — which had never been
 * decremented — gained stock that does not exist. Three cancelled phones lost
 * three real ones and invented three imaginary ones.
 *
 * The five shapes are tested separately because they are five different
 * answers, not one answer with edge cases. In particular an import restores
 * nothing *unless* it was bought as a variant, which is the case that made the
 * old shape wrong and the one most likely to be broken again.
 */
class SellerConsoleCancellationTest extends TestCase
{
    use RefreshDatabase;

    private User $vendorUser;
    private User $customer;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorUser = User::create([
            'name' => 'Seller', 'email' => 'sc-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000111',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->vendorUser->id, 'business_name' => 'Console Traders',
            'phone' => '0700000111', 'is_approved' => true,
        ]);

        $this->category = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->customer = User::create([
            'name' => 'Shopper', 'email' => 'sc-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000112',
        ]);
    }

    private function product(string $name, string $availability, int $stock): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $this->subcategory->id, 'name' => $name,
            'new_price' => 50000, 'stock' => $stock,
            'availability' => $availability,
            'source_country' => $availability === 'import' ? 'CN' : 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    private function order(Product $product, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'reference'       => '2K-CONSOLE1',
            'user_id'         => $this->customer->id,
            'vendor_id'       => $this->vendor->id,
            'product_id'      => $product->id,
            'quantity'        => 3,
            'price'           => 50000,
            'total'           => 150000,
            'status'          => 'pending',
            'payment_method'  => 'cash_on_delivery',
            'payment_status'  => 'not_required',
            'fulfilment_type' => $product->availability,
        ], $overrides));
    }

    private function variant(Product $product, int $stock): ProductVariant
    {
        return ProductVariant::create([
            'product_id' => $product->id,
            'sku'        => 'SKU-' . $product->id . '-' . $stock,
            'price'      => 700000,
            'stock'      => $stock,
            'is_active'  => true,
        ]);
    }

    private function cancel(Order $order)
    {
        Sanctum::actingAs($this->vendorUser);

        return $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'cancelled']);
    }

    /* ---------------------------------------------------------------- */
    /* 1. a plain product                                                */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_a_plain_local_line_returns_units_to_the_product(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);

        $this->cancel($this->order($product))->assertOk();

        $this->assertSame(10, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* 2. an alternative offer                                           */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_an_offer_line_credits_the_offer_only(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);

        $offer = ProductOffer::create([
            'product_id' => $product->id, 'vendor_id' => $this->vendor->id,
            'availability' => 'local', 'price' => 45000, 'stock' => 5,
            'source_country' => 'TZ', 'is_active' => true,
        ]);
        $offer->decrement('stock', 3);

        $this->cancel($this->order($product, ['offer_id' => $offer->id]))->assertOk();

        $this->assertSame(5, $offer->fresh()->stock);
        $this->assertSame(10, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* 3. a local variant — the case that was broken                     */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_a_local_variant_credits_the_variant(): void
    {
        $product = $this->product('Local Phone', 'local', 10);
        $variant = $this->variant($product, 6);
        $variant->decrement('stock', 3);

        $this->cancel($this->order($product, ['product_variant_id' => $variant->id]))->assertOk();

        // Previously: stayed at 3. The three units were lost for good.
        $this->assertSame(6, $variant->fresh()->stock);
    }

    public function test_cancelling_a_variant_creates_no_phantom_parent_stock(): void
    {
        $product = $this->product('Local Phone', 'local', 10);
        $variant = $this->variant($product, 6);
        $variant->decrement('stock', 3);

        $this->cancel($this->order($product, ['product_variant_id' => $variant->id]))->assertOk();

        // Previously: 13. The parent was never decremented, so crediting it
        // told the catalogue it held three phones that do not exist.
        $this->assertSame(10, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* 4. an imported product                                            */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_an_imported_line_restores_nothing(): void
    {
        // Bought in per order, so checkout reserved nothing and there is
        // nothing to give back.
        $product = $this->product('Imported Phone', 'import', 0);

        $this->cancel($this->order($product))->assertOk();

        $this->assertSame(0, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* 5. an imported variant — the exception to (4)                     */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_an_imported_variant_still_restores_the_variant(): void
    {
        // A variant tracks its own stock, so the units exist as a specific
        // combination even when the product is sourced abroad. Checkout
        // decrements it, so cancelling must credit it — the one place where
        // "imports restore nothing" does not apply.
        $product = $this->product('Imported Phone', 'import', 0);
        $variant = $this->variant($product, 4);
        $variant->decrement('stock', 3);

        $this->cancel($this->order($product, ['product_variant_id' => $variant->id]))->assertOk();

        $this->assertSame(4, $variant->fresh()->stock);
        $this->assertSame(0, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* unrelated behaviour is unchanged                                  */
    /* ---------------------------------------------------------------- */

    public function test_moving_an_order_forward_restores_no_stock(): void
    {
        // Only cancellation returns units. Advancing the journey must not.
        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);
        $order = $this->order($product);

        Sanctum::actingAs($this->vendorUser);
        $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'shipped'])
            ->assertOk();

        $this->assertSame(7, $product->fresh()->stock);
        $this->assertSame('shipped', $order->fresh()->status);
    }

    public function test_cancelling_still_records_the_event_and_closes_the_order(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);
        $order = $this->order($product);

        $this->cancel($order)->assertOk();

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame(
            1,
            OrderEvent::where('reference', $order->reference)
                ->where('status', OrderJourney::CANCELLED)
                ->count(),
        );
    }

    public function test_a_closed_order_cannot_be_cancelled_again(): void
    {
        $product = $this->product('Local Kettle', 'local', 7);
        $order = $this->order($product, ['status' => 'cancelled']);

        $this->cancel($order)->assertStatus(422);

        // The guard is what makes restoring safe to do exactly once.
        $this->assertSame(7, $product->fresh()->stock);
    }

    public function test_a_rival_vendor_is_still_refused(): void
    {
        $rivalUser = User::create([
            'name' => 'Rival', 'email' => 'sc-rival@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000113',
        ]);
        Vendor::create([
            'user_id' => $rivalUser->id, 'business_name' => 'Rival Traders',
            'phone' => '0700000113', 'is_approved' => true,
        ]);

        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);
        $order = $this->order($product);

        Sanctum::actingAs($rivalUser);
        $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'cancelled'])
            ->assertNotFound();

        $this->assertSame(7, $product->fresh()->stock);
        $this->assertSame('pending', $order->fresh()->status);
    }
}
