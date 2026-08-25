<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductVariant;
use App\Models\OrderEvent;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Support\OrderJourney;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cancelling an order line returns its units to whatever row was holding them.
 *
 * The legacy vendor cancellation changed the status and stopped. Every
 * cancellation through it therefore destroyed stock: the units were taken at
 * checkout, the order was withdrawn, and nothing put them back. The catalogue
 * reported fewer items than the seller had, permanently and silently.
 *
 * The interesting cases are not "did the number go up" but *which* number.
 * Checkout takes stock from the variant, the offer or the product depending on
 * what was bought, and an import takes none at all — so a cancellation that
 * credits the wrong row is as wrong as one that credits nothing, and worse,
 * because it invents units that never existed.
 */
class VendorCancellationStockTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $vendorUser;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorUser = User::create([
            'name' => 'Seller', 'email' => 'vc-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000101',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->vendorUser->id, 'business_name' => 'Cancel Traders',
            'phone' => '0700000101', 'is_approved' => true,
        ]);

        $this->category = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->customer = User::create([
            'name' => 'Shopper', 'email' => 'vc-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000102',
        ]);
    }

    private function product(string $name, string $availability, int $stock = 10): Product
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
            'reference'       => '2K-CANCEL01',
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

    private function cancel(Order $order)
    {
        Sanctum::actingAs($this->vendorUser);

        return $this->postJson("/api/vendor/orders/{$order->id}/cancel");
    }

    /* ---------------------------------------------------------------- */
    /* local stock comes back                                            */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_a_local_line_returns_its_units_to_the_product(): void
    {
        // 10 on the shelf, 3 sold, 7 left.
        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);
        $order = $this->order($product);

        $this->cancel($order)->assertOk();

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_cancelling_an_offer_line_credits_the_offer_not_the_product(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);

        $offer = ProductOffer::create([
            'product_id' => $product->id, 'vendor_id' => $this->vendor->id,
            'availability' => 'local', 'price' => 45000, 'stock' => 5,
            'source_country' => 'TZ', 'is_active' => true,
        ]);

        $offer->decrement('stock', 3);
        $order = $this->order($product, ['offer_id' => $offer->id]);

        $this->cancel($order)->assertOk();

        $this->assertSame(5, $offer->fresh()->stock);
        // The product's own count was never touched, so crediting it here would
        // conjure three kettles out of nothing.
        $this->assertSame(10, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* imports never held anything                                       */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_an_imported_line_does_not_invent_local_stock(): void
    {
        // An import is bought in per order, so checkout reserved nothing. There
        // is nothing to give back, and giving something back would tell the
        // catalogue it has units nobody has ever seen.
        $product = $this->product('Imported Phone', 'import', 0);
        $order = $this->order($product);

        $this->cancel($order)->assertOk();

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_an_imported_variant_is_still_restored(): void
    {
        // The exception to the rule above. A variant tracks its own stock, so
        // the units exist as a specific combination even when the product is
        // sourced abroad — checkout decrements it, so cancelling must credit it.
        $product = $this->product('Imported Phone', 'import', 0);

        $variant = ProductVariant::create([
            'product_id' => $product->id, 'sku' => 'IPH-BLK-256',
            'price' => 900000, 'stock' => 4, 'is_active' => true,
        ]);

        $variant->decrement('stock', 3);
        $order = $this->order($product, ['product_variant_id' => $variant->id]);

        $this->cancel($order)->assertOk();

        $this->assertSame(4, $variant->fresh()->stock);
        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_cancelling_a_variant_line_credits_the_variant_not_the_parent(): void
    {
        $product = $this->product('Local Phone', 'local', 10);

        $variant = ProductVariant::create([
            'product_id' => $product->id, 'sku' => 'PHN-RED-128',
            'price' => 700000, 'stock' => 6, 'is_active' => true,
        ]);

        $variant->decrement('stock', 3);
        $order = $this->order($product, ['product_variant_id' => $variant->id]);

        $this->cancel($order)->assertOk();

        $this->assertSame(6, $variant->fresh()->stock);
        // Crediting the parent would inflate the catalogue permanently: the
        // product's count is not what was decremented.
        $this->assertSame(10, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* exactly once                                                      */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_twice_returns_the_units_only_once(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);
        $order = $this->order($product);

        $this->cancel($order)->assertOk();
        $this->cancel($order)->assertStatus(400);

        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_a_closed_order_cannot_be_cancelled_into_extra_stock(): void
    {
        $product = $this->product('Local Kettle', 'local', 7);
        $order = $this->order($product, ['status' => 'completed']);

        $this->cancel($order)->assertStatus(400);

        $this->assertSame('completed', $order->fresh()->status);
        $this->assertSame(7, $product->fresh()->stock);
    }

    /* ---------------------------------------------------------------- */
    /* the buyer is told                                                 */
    /* ---------------------------------------------------------------- */

    public function test_cancelling_records_an_event_for_the_buyers_timeline(): void
    {
        // The tracking timeline is built from recorded events, so a step
        // nothing was written for is a step that never happened. This path
        // wrote nothing, and an order withdrawn through it went on showing as
        // open on the buyer's screen.
        $product = $this->product('Local Kettle', 'local', 10);
        $order = $this->order($product);

        $this->cancel($order)->assertOk();

        $event = OrderEvent::where('reference', $order->reference)
            ->where('status', OrderJourney::CANCELLED)
            ->first();

        $this->assertNotNull($event);
        $this->assertSame($order->id, $event->order_id);
        $this->assertSame(OrderJourney::label(OrderJourney::CANCELLED), $event->title);
        $this->assertNotNull($event->happened_at);
    }

    public function test_a_refused_cancellation_records_no_event(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);
        $order = $this->order($product);

        Sanctum::actingAs($this->customer);
        $this->postJson("/api/vendor/orders/{$order->id}/cancel")->assertStatus(403);

        $this->assertSame(0, OrderEvent::where('reference', $order->reference)->count());
    }

    /* ---------------------------------------------------------------- */
    /* authorisation still holds                                         */
    /* ---------------------------------------------------------------- */

    public function test_a_refused_cancellation_restores_nothing(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);
        $order = $this->order($product);

        // A customer is not a seller: refused before the order is even read,
        // so no stock moves and the order is untouched.
        Sanctum::actingAs($this->customer);
        $this->postJson("/api/vendor/orders/{$order->id}/cancel")->assertStatus(403);

        $this->assertSame(7, $product->fresh()->stock);
        $this->assertSame('pending', $order->fresh()->status);
    }

    /* ---------------------------------------------------------------- */
    /* the active paths are unchanged                                    */
    /* ---------------------------------------------------------------- */

    public function test_the_seller_console_cancellation_is_untouched(): void
    {
        $product = $this->product('Local Kettle', 'local', 10);
        $product->decrement('stock', 3);
        $order = $this->order($product);

        Sanctum::actingAs($this->vendorUser);

        $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'cancelled'])
            ->assertOk();

        $this->assertSame(10, $product->fresh()->stock);
        $this->assertSame('cancelled', $order->fresh()->status);
    }
}
