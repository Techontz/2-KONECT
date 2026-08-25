<?php

namespace Tests\Feature\Payments;

use App\Filament\Resources\OrderResource\Pages\ListOrders;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Cancelling an order line from the admin panel.
 *
 * The fourth copy of the restoration rule lived here, and carried the same gap
 * as the seller console: it asked only whether the line was an import, so a
 * cancelled variant credited the parent product — which had never been
 * decremented — and left the variant short. All four callers now share
 * {@see \App\Support\StockReservation}, and this exercises the admin one
 * through the real Filament action rather than trusting that they do.
 */
class AdminOrderCancellationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;
    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin', 'email' => 'ac-admin@test.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000121',
        ]);

        $seller = User::create([
            'name' => 'Seller', 'email' => 'ac-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000122',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $seller->id, 'business_name' => 'Admin Traders',
            'phone' => '0700000122', 'is_approved' => true,
        ]);

        $this->category = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->customer = User::create([
            'name' => 'Shopper', 'email' => 'ac-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000123',
        ]);
    }

    private function product(string $availability, int $stock): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $this->subcategory->id, 'name' => 'Phone',
            'new_price' => 50000, 'stock' => $stock,
            'availability' => $availability,
            'source_country' => $availability === 'import' ? 'CN' : 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    private function order(Product $product, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'reference'       => '2K-ADMINC01',
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

    private function cancelFromPanel(Order $order): void
    {
        Livewire::actingAs($this->admin)
            ->test(ListOrders::class)
            ->callTableAction('cancel', $order);
    }

    public function test_cancelling_a_variant_line_credits_the_variant_not_the_parent(): void
    {
        $product = $this->product('local', 10);

        $variant = ProductVariant::create([
            'product_id' => $product->id, 'sku' => 'ADM-RED-128',
            'price' => 700000, 'stock' => 6, 'is_active' => true,
        ]);
        $variant->decrement('stock', 3);

        $this->cancelFromPanel($this->order($product, ['product_variant_id' => $variant->id]));

        $this->assertSame(6, $variant->fresh()->stock);
        // Previously 13: three phones the seller does not have.
        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_cancelling_a_plain_local_line_still_returns_units_to_the_product(): void
    {
        $product = $this->product('local', 10);
        $product->decrement('stock', 3);

        $order = $this->order($product);
        $this->cancelFromPanel($order);

        $this->assertSame(10, $product->fresh()->stock);
        $this->assertSame('cancelled', $order->fresh()->status);
    }

    public function test_cancelling_an_imported_line_invents_no_stock(): void
    {
        $product = $this->product('import', 0);

        $this->cancelFromPanel($this->order($product));

        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_cancelling_an_imported_variant_still_restores_the_variant(): void
    {
        $product = $this->product('import', 0);

        $variant = ProductVariant::create([
            'product_id' => $product->id, 'sku' => 'ADM-IMP-256',
            'price' => 900000, 'stock' => 4, 'is_active' => true,
        ]);
        $variant->decrement('stock', 3);

        $this->cancelFromPanel($this->order($product, ['product_variant_id' => $variant->id]));

        $this->assertSame(4, $variant->fresh()->stock);
        $this->assertSame(0, $product->fresh()->stock);
    }
}
