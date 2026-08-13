<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Vendor portal: role separation, tenant isolation and media safety.
 *
 * These are the rules that must not regress — a seller reaching another
 * seller's data, or an edit quietly destroying a product's photography, are
 * both far more damaging than a broken screen.
 */
class VendorPortalTest extends TestCase
{
    use RefreshDatabase;

    private User $vendorUser;
    private Vendor $vendor;
    private User $rivalUser;
    private Vendor $rival;
    private User $customer;
    private Category $category;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = Category::create(['name' => 'Electronics']);

        [$this->vendorUser, $this->vendor] = $this->makeVendor('one', 'Store One');
        [$this->rivalUser, $this->rival] = $this->makeVendor('two', 'Store Two');

        $this->customer = User::create([
            'name' => 'Shopper', 'email' => 'shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000009',
        ]);

        $this->product = Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'name' => 'Store One Speaker', 'new_price' => 50000, 'stock' => 8,
        ]);

        ProductImage::create(['product_id' => $this->product->id, 'image' => 'products/original-a.jpg']);
        ProductImage::create(['product_id' => $this->product->id, 'image' => 'products/original-b.jpg']);
    }

    private function makeVendor(string $slug, string $business): array
    {
        $user = User::create([
            'name' => "Owner {$slug}", 'email' => "vendor-{$slug}@test.local",
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => "07000000{$slug}",
        ]);

        $vendor = Vendor::create([
            'user_id' => $user->id, 'business_name' => $business,
            'phone' => '0700000000', 'is_approved' => true,
        ]);

        return [$user, $vendor];
    }

    /* ---------------- role separation ---------------- */

    public function test_a_customer_cannot_reach_the_vendor_portal(): void
    {
        Sanctum::actingAs($this->customer);

        $this->getJson('/api/shop/vendor/dashboard')->assertForbidden();
        $this->getJson('/api/shop/vendor/products')->assertForbidden();
        $this->getJson('/api/shop/vendor/orders')->assertForbidden();
    }

    public function test_a_customer_cannot_edit_or_delete_a_vendors_product(): void
    {
        Sanctum::actingAs($this->customer);

        // Previously this reached `$user->vendor->id` on null and 500'd.
        $this->postJson("/api/products/{$this->product->id}", ['name' => 'Hijacked'])
            ->assertForbidden();

        $this->deleteJson("/api/products/{$this->product->id}")->assertForbidden();

        $this->assertSame('Store One Speaker', $this->product->fresh()->name);
    }

    /* ---------------- tenant isolation ---------------- */

    public function test_a_vendor_only_sees_their_own_products(): void
    {
        Product::create([
            'vendor_id' => $this->rival->id, 'category_id' => $this->category->id,
            'name' => 'Store Two Kettle', 'new_price' => 20000, 'stock' => 4,
        ]);

        Sanctum::actingAs($this->vendorUser);

        $names = collect($this->getJson('/api/shop/vendor/products')->assertOk()->json('products'))
            ->pluck('name');

        $this->assertTrue($names->contains('Store One Speaker'));
        $this->assertFalse($names->contains('Store Two Kettle'));
    }

    public function test_a_vendor_cannot_edit_another_vendors_product(): void
    {
        Sanctum::actingAs($this->rivalUser);

        $this->postJson("/api/products/{$this->product->id}", ['name' => 'Stolen'])
            ->assertNotFound();

        $this->assertSame('Store One Speaker', $this->product->fresh()->name);
    }

    public function test_a_vendor_cannot_action_another_vendors_order(): void
    {
        $order = Order::create([
            'reference' => 'D2K-TEST0001', 'user_id' => $this->customer->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $this->product->id,
            'quantity' => 1, 'price' => 50000, 'total' => 50000, 'status' => 'pending',
        ]);

        Sanctum::actingAs($this->rivalUser);

        $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'cancelled'])
            ->assertNotFound();

        $this->assertSame('pending', $order->fresh()->status);
    }

    /* ---------------- media safety ---------------- */

    public function test_uploading_a_new_photo_does_not_destroy_existing_photos(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->vendorUser);

        $this->assertSame(2, $this->product->images()->count());

        $this->post("/api/products/{$this->product->id}", [
            'name'   => 'Store One Speaker',
            'images' => [UploadedFile::fake()->image('extra.jpg')],
        ])->assertOk();

        // The whole point: adding an angle must not wipe the gallery.
        $this->assertSame(
            3,
            $this->product->images()->count(),
            'A new upload must be added to the gallery, not replace it.'
        );

        $paths = $this->product->images()->pluck('image');
        $this->assertTrue($paths->contains('products/original-a.jpg'));
        $this->assertTrue($paths->contains('products/original-b.jpg'));
    }

    public function test_photos_are_only_replaced_when_explicitly_requested(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->vendorUser);

        $this->post("/api/products/{$this->product->id}", [
            'name'          => 'Store One Speaker',
            'remove_images' => 'true',
            'images'        => [UploadedFile::fake()->image('replacement.jpg')],
        ])->assertOk();

        $paths = $this->product->images()->pluck('image');

        $this->assertCount(1, $paths);
        $this->assertFalse($paths->contains('products/original-a.jpg'));
    }

    public function test_a_single_photo_can_be_removed_by_id(): void
    {
        Sanctum::actingAs($this->vendorUser);

        $first = $this->product->images()->first();

        $this->post("/api/products/{$this->product->id}", [
            'name'             => 'Store One Speaker',
            'remove_image_ids' => [$first->id],
        ])->assertOk();

        $this->assertSame(1, $this->product->images()->count());
        $this->assertNull(ProductImage::find($first->id));
    }

    /* ---------------- dashboard ---------------- */

    public function test_dashboard_reports_only_this_vendors_figures(): void
    {
        Order::create([
            'reference' => 'D2K-TEST0002', 'user_id' => $this->customer->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $this->product->id,
            'quantity' => 2, 'price' => 50000, 'total' => 100000, 'status' => 'completed',
        ]);

        // A rival sale that must not appear in these numbers.
        $rivalProduct = Product::create([
            'vendor_id' => $this->rival->id, 'category_id' => $this->category->id,
            'name' => 'Rival Item', 'new_price' => 999999, 'stock' => 1,
        ]);
        Order::create([
            'reference' => 'D2K-TEST0003', 'user_id' => $this->customer->id,
            'vendor_id' => $this->rival->id, 'product_id' => $rivalProduct->id,
            'quantity' => 1, 'price' => 999999, 'total' => 999999, 'status' => 'completed',
        ]);

        Sanctum::actingAs($this->vendorUser);

        $stats = $this->getJson('/api/shop/vendor/dashboard')->assertOk()->json('stats');

        $this->assertSame(1, $stats['products']);
        $this->assertSame(1, $stats['orders']);
        $this->assertEquals(100000, $stats['earnings']);
        $this->assertSame(2, $stats['units_sold']);
    }

    public function test_cancelling_an_order_line_restores_stock(): void
    {
        $order = Order::create([
            'reference' => 'D2K-TEST0004', 'user_id' => $this->customer->id,
            'vendor_id' => $this->vendor->id, 'product_id' => $this->product->id,
            'quantity' => 3, 'price' => 50000, 'total' => 150000, 'status' => 'pending',
        ]);

        Sanctum::actingAs($this->vendorUser);

        $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'cancelled'])
            ->assertOk();

        $this->assertSame(11, $this->product->fresh()->stock);
    }
}
