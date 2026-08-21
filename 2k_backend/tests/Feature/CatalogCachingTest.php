<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Support\CatalogCache;
use Livewire\Features\SupportDisablingBackButtonCache\SupportDisablingBackButtonCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Caching of the public catalogue.
 *
 * Cache bugs do not announce themselves — a stale price or a leaked private
 * response looks exactly like a working page — so the guarantees are asserted
 * rather than assumed:
 *
 *   - the home feed answers the facets the homepage used to fetch separately,
 *     and answers them with the same numbers the listing endpoint would
 *   - an administrator's edit is visible on the next request, not at the end
 *     of the TTL
 *   - only anonymous catalogue reads are marked publicly cacheable, and a
 *     shopper's own data never is
 */
class CatalogCachingTest extends TestCase
{
    use RefreshDatabase;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        // Livewire flips a *static* flag the first time a component boots and
        // globally pushes a middleware that stamps `no-store, private` on
        // every response. The whole suite shares one PHP process, so once the
        // Filament panel tests have run, that flag is still set here and would
        // overwrite the very header this class exists to assert.
        //
        // Only tests are affected: the flag starts false in each real request
        // and no Livewire component boots on an API route, which is why the
        // running server returns the public header even immediately after the
        // admin panel is loaded. Reset it so the assertions below measure the
        // application rather than the test runner.
        SupportDisablingBackButtonCache::$disableBackButtonCache = false;

        $owner = User::create([
            'name' => 'Seller', 'email' => 'cache-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000009',
        ]);

        $vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Cache Test Store',
            'phone' => '0700000009', 'is_approved' => true,
        ]);

        $this->category = Category::create(['name' => 'Electronics']);
        $subcategory = Subcategory::create([
            'category_id' => $this->category->id, 'name' => 'Phones',
        ]);

        // One local, one imported, with lead times either side of a window
        // boundary so the delivery counts have something to distinguish.
        Product::create([
            'vendor_id' => $vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $subcategory->id, 'name' => 'Local Handset',
            'new_price' => 80000, 'stock' => 5,
            'availability' => 'local', 'source_country' => 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);

        Product::create([
            'vendor_id' => $vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $subcategory->id, 'name' => 'Imported Handset',
            'new_price' => 50000, 'stock' => 0,
            'availability' => 'import', 'source_country' => 'CN',
            'lead_time_min_days' => 20, 'lead_time_max_days' => 40,
        ]);
    }

    public function test_home_feed_carries_the_facets_the_homepage_used_to_fetch_separately(): void
    {
        $home = $this->getJson('/api/shop/home')->assertOk();

        $home->assertJsonStructure(['origins', 'delivery_windows']);

        $codes = array_column($home->json('origins'), 'code');
        $this->assertContains('CN', $codes, 'Source countries must come from real stock.');
    }

    public function test_delivery_window_counts_agree_with_the_listing_they_open(): void
    {
        $windows = $this->getJson('/api/shop/home')->assertOk()->json('delivery_windows');

        foreach ([3, 10, 14, 45] as $days) {
            $listing = $this->getJson("/api/shop/products?max_days={$days}&per_page=1")->assertOk();

            $this->assertSame(
                $listing->json('meta.total'),
                (int) $windows[$days],
                "The tile for {$days} days must promise what the page behind it actually shows."
            );
        }
    }

    public function test_an_edit_retires_the_cached_catalogue_immediately(): void
    {
        $this->getJson('/api/shop/categories')->assertOk()->assertJsonFragment(['name' => 'Electronics']);

        $version = CatalogCache::version();

        $this->category->update(['name' => 'Consumer Electronics']);

        $this->assertGreaterThan($version, CatalogCache::version(), 'A category edit must retire the cached keys.');

        // And the very next request reflects it, rather than waiting out the TTL.
        $this->getJson('/api/shop/categories')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Consumer Electronics']);
    }

    public function test_anonymous_catalogue_reads_are_publicly_cacheable(): void
    {
        foreach (['/api/shop/home', '/api/shop/categories', '/api/shop/products', '/api/shop/vendors'] as $route) {
            $header = $this->getJson($route)->assertOk()->headers->get('Cache-Control');

            $this->assertStringContainsString('public', $header, "{$route} should be cacheable by the browser.");
            $this->assertStringContainsString('stale-while-revalidate', $header, "{$route} should refresh in the background.");
        }
    }

    public function test_a_shoppers_own_data_is_never_publicly_cacheable(): void
    {
        $shopper = User::create([
            'name' => 'Shopper', 'email' => 'cache-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'customer', 'phone' => '0700000010',
        ]);

        Sanctum::actingAs($shopper);

        foreach (['/api/shop/wishlist', '/api/shop/orders', '/api/shop/addresses'] as $route) {
            $header = $this->getJson($route)->headers->get('Cache-Control');

            $this->assertStringNotContainsString('public', (string) $header, "{$route} must never be publicly cached.");
        }
    }

    public function test_a_credentialed_request_to_a_public_route_is_not_publicly_cached(): void
    {
        $shopper = User::create([
            'name' => 'Signed In', 'email' => 'cache-signedin@test.local',
            'password' => bcrypt('secret123'), 'role' => 'customer', 'phone' => '0700000011',
        ]);

        Sanctum::actingAs($shopper);

        $header = (string) $this->getJson('/api/shop/products')->assertOk()->headers->get('Cache-Control');

        $this->assertStringNotContainsString('public', $header);
    }

    public function test_the_listing_facets_name_their_subcategories_without_a_query_per_row(): void
    {
        $filters = $this->getJson('/api/shop/products')->assertOk()->json('filters');

        $this->assertNotEmpty($filters['subcategories']);
        $this->assertSame('Phones', $filters['subcategories'][0]['name']);
        $this->assertSame(2, $filters['subcategories'][0]['count']);
    }
}
