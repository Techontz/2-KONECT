<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Public storefront: everything a visitor can reach without an account, plus
 * the boundary where authentication starts being required.
 */
class StorefrontTest extends TestCase
{
    use RefreshDatabase;

    private Category $category;
    private Vendor $vendor;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller One', 'email' => 'seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000001',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Kariakoo Test Store',
            'phone' => '0700000001', 'is_approved' => true,
        ]);

        $this->category = Category::create(['name' => 'Electronics']);
        $subcategory = Subcategory::create([
            'category_id' => $this->category->id, 'name' => 'Phones',
        ]);

        $this->product = Product::create([
            'vendor_id' => $this->vendor->id,
            'category_id' => $this->category->id,
            'subcategory_id' => $subcategory->id,
            'name' => 'Samsung Galaxy A55',
            'description' => 'A test handset',
            'old_price' => 100000, 'new_price' => 80000, 'stock' => 10,
        ]);

        ProductImage::create([
            'product_id' => $this->product->id,
            'image' => 'products/test-phone.jpg',
        ]);

        Banner::create(['title' => 'Launch', 'image' => 'banners/test.jpg', 'is_active' => true]);
    }

    public function test_home_feed_is_public_and_returns_real_shape(): void
    {
        $this->getJson('/api/shop/home')
            ->assertOk()
            ->assertJsonStructure(['banners', 'categories', 'shelves', 'deals']);
    }

    public function test_product_listing_is_public_and_paginated(): void
    {
        $this->getJson('/api/shop/products')
            ->assertOk()
            ->assertJsonStructure([
                'products' => [['id', 'name', 'image', 'price' => ['currency', 'current', 'was', 'discount_percent'], 'rating', 'stock', 'badges']],
                'meta' => ['total', 'per_page', 'current_page', 'last_page', 'has_more'],
                'filters' => ['price', 'subcategories'],
            ]);
    }

    public function test_image_urls_are_absolute_and_resolve_from_storage(): void
    {
        $response = $this->getJson('/api/shop/products')->assertOk();

        $image = $response->json('products.0.image');

        $this->assertNotNull($image, 'Product card must carry an image URL.');
        $this->assertStringStartsWith('http', $image);
        $this->assertStringContainsString('storage/products/', $image);
    }

    public function test_price_payload_computes_discount_from_stored_amounts(): void
    {
        $price = $this->getJson("/api/shop/products/{$this->product->id}")
            ->assertOk()
            ->json('product.price');

        $this->assertSame('TZS', $price['currency']);
        $this->assertEquals(80000, $price['current']);
        $this->assertEquals(100000, $price['was']);
        $this->assertSame(20, $price['discount_percent']);
    }

    public function test_search_matches_name_and_keeps_filters_grouped(): void
    {
        Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'name' => 'Completely Unrelated Kettle', 'new_price' => 5000, 'stock' => 3,
        ]);

        $response = $this->getJson('/api/shop/products?q=Galaxy')->assertOk();

        $names = collect($response->json('products'))->pluck('name');

        $this->assertTrue($names->contains('Samsung Galaxy A55'));
        $this->assertFalse(
            $names->contains('Completely Unrelated Kettle'),
            'An OR search term must not escape the surrounding filters.'
        );
    }

    public function test_category_filter_and_search_combine_correctly(): void
    {
        $other = Category::create(['name' => 'Groceries']);
        Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $other->id,
            'name' => 'Galaxy Brand Sugar', 'new_price' => 3000, 'stock' => 5,
        ]);

        // Both products match "Galaxy"; only one is in Electronics.
        $response = $this->getJson("/api/shop/products?q=Galaxy&category_id={$this->category->id}")
            ->assertOk();

        $this->assertSame(1, $response->json('meta.total'));
        $this->assertSame('Samsung Galaxy A55', $response->json('products.0.name'));
    }

    public function test_sorting_by_price_is_applied_over_the_default_order(): void
    {
        Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'name' => 'Cheap Charger', 'new_price' => 1000, 'stock' => 5,
        ]);

        $first = $this->getJson('/api/shop/products?sort=price_asc')->assertOk()
            ->json('products.0.name');

        $this->assertSame('Cheap Charger', $first, 'price_asc must override the newest-first base order.');
    }

    public function test_suggestions_require_two_characters(): void
    {
        $this->getJson('/api/shop/products/suggest?q=a')
            ->assertOk()
            ->assertJson(['products' => [], 'categories' => []]);

        $this->getJson('/api/shop/products/suggest?q=Galaxy')
            ->assertOk()
            ->assertJsonCount(1, 'products');
    }

    public function test_missing_product_returns_404_json(): void
    {
        $this->getJson('/api/shop/products/999999')
            ->assertNotFound()
            ->assertJson(['message' => 'Product not found.']);
    }

    /* ---------------- authentication boundary ---------------- */

    public function test_protected_endpoints_return_401_json_not_a_redirect(): void
    {
        foreach (['/api/shop/wishlist', '/api/shop/orders', '/api/shop/vendor/dashboard'] as $endpoint) {
            $this->get($endpoint)
                ->assertStatus(401)
                ->assertJson(['message' => 'Unauthenticated.']);
        }
    }

    public function test_wishlist_round_trip_for_a_signed_in_shopper(): void
    {
        $shopper = User::create([
            'name' => 'Shopper', 'email' => 'shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000002',
        ]);

        Sanctum::actingAs($shopper);

        $this->postJson('/api/shop/wishlist', ['product_id' => $this->product->id])
            ->assertCreated();

        $this->getJson('/api/shop/wishlist')
            ->assertOk()
            ->assertJsonCount(1, 'products');

        // Saving twice must not duplicate the row.
        $this->postJson('/api/shop/wishlist', ['product_id' => $this->product->id])->assertCreated();
        $this->getJson('/api/shop/wishlist')->assertJsonCount(1, 'products');

        $this->deleteJson("/api/shop/wishlist/{$this->product->id}")->assertOk();
        $this->getJson('/api/shop/wishlist')->assertJsonCount(0, 'products');
    }

    public function test_guest_wishlist_is_merged_on_sync_without_losing_saved_items(): void
    {
        $shopper = User::create([
            'name' => 'Shopper', 'email' => 'shopper2@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000003',
        ]);

        $second = Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'name' => 'Second Item', 'new_price' => 9000, 'stock' => 4,
        ]);

        Sanctum::actingAs($shopper);

        $this->postJson('/api/shop/wishlist', ['product_id' => $this->product->id])->assertCreated();

        // The guest list carries a different product; both must survive.
        $this->postJson('/api/shop/wishlist/sync', ['product_ids' => [$second->id]])
            ->assertOk()
            ->assertJsonCount(2, 'products');
    }

    /* ---------------- checkout ---------------- */

    public function test_placing_an_order_decrements_stock_and_returns_a_reference(): void
    {
        $shopper = User::create([
            'name' => 'Buyer', 'email' => 'buyer@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000004',
        ]);

        Sanctum::actingAs($shopper);

        $response = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 3]],
            'delivery_address' => 'Kariakoo, Dar es Salaam',
            'customer_phone' => '0700000004',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated();

        $reference = $response->json('reference');
        $this->assertNotEmpty($reference);

        $this->assertSame(7, $this->product->fresh()->stock, 'Checkout must reserve the stock it sells.');

        $this->getJson('/api/shop/orders')
            ->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.reference', $reference);
    }

    public function test_checkout_refuses_to_oversell(): void
    {
        $shopper = User::create([
            'name' => 'Greedy', 'email' => 'greedy@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000005',
        ]);

        Sanctum::actingAs($shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 99]],
            'delivery_address' => 'Kariakoo',
            'customer_phone' => '0700000005',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);

        $this->assertSame(10, $this->product->fresh()->stock, 'A rejected order must not touch stock.');
        $this->assertSame(0, Order::count());
    }

    public function test_cancelling_an_order_returns_the_stock(): void
    {
        $shopper = User::create([
            'name' => 'Buyer2', 'email' => 'buyer2@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000006',
        ]);

        Sanctum::actingAs($shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->product->id, 'quantity' => 4]],
            'delivery_address' => 'Kariakoo',
            'customer_phone' => '0700000006',
            'payment_method' => 'cash_on_delivery',
        ])->json('reference');

        $this->assertSame(6, $this->product->fresh()->stock);

        $this->postJson("/api/shop/orders/{$reference}/cancel")->assertOk();

        $this->assertSame(10, $this->product->fresh()->stock, 'Cancelling must put the units back on sale.');
    }
}
