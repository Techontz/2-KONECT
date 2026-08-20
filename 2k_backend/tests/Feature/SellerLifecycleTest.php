<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VerificationRequirement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Seller approval and verification.
 *
 * These are two different promises and the tests treat them that way: one
 * decides whether a shop may trade, the other whether shoppers see a
 * checkmark. The dangerous failures are a pending seller publishing stock, or
 * a seller granting themselves the badge, so both are asserted against the
 * database rather than the response body alone.
 */
class SellerLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $sellerUser;
    private Vendor $vendor;
    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->sellerUser = User::create([
            'name' => 'Seller', 'email' => 'seller@test.local',
            'password' => bcrypt('password'), 'role' => 'vendor',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->sellerUser->id,
            'business_name' => 'Kariakoo Mobile Hub',
            'phone' => '0764224477',
            'is_approved' => false,
            'seller_status' => 'pending',
        ]);

        $this->category = Category::create(['name' => 'Electronics']);

        VerificationRequirement::create([
            'name' => 'National ID (NIDA)', 'document_type' => 'file',
            'is_required' => true, 'is_active' => true, 'sort_order' => 1,
        ]);
        VerificationRequirement::create([
            'name' => 'TIN number', 'document_type' => 'text',
            'is_required' => false, 'is_active' => true, 'sort_order' => 2,
        ]);
    }

    private function productPayload(): array
    {
        return [
            'name' => 'Samsung Galaxy A17',
            'category_id' => $this->category->id,
            'new_price' => 470000,
            'stock' => 5,
            'images' => [UploadedFile::fake()->image('a.jpg')],
        ];
    }

    public function test_a_pending_seller_cannot_publish_products(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $this->post('/api/products', $this->productPayload())
            ->assertStatus(403)
            ->assertJsonPath('seller_status', 'pending');

        // Nothing reached the catalogue.
        $this->assertSame(0, \App\Models\Product::count());
    }

    public function test_an_approved_seller_can_publish(): void
    {
        $this->vendor->update(['is_approved' => true, 'seller_status' => 'approved']);
        Sanctum::actingAs($this->sellerUser);

        $this->post('/api/products', $this->productPayload())->assertSuccessful();

        $this->assertDatabaseHas('products', [
            'name' => 'Samsung Galaxy A17',
            'vendor_id' => $this->vendor->id,
        ]);
    }

    public function test_a_suspended_seller_cannot_publish(): void
    {
        $this->vendor->update(['is_approved' => false, 'seller_status' => 'suspended']);
        Sanctum::actingAs($this->sellerUser);

        $this->post('/api/products', $this->productPayload())->assertStatus(403);
        $this->assertSame(0, \App\Models\Product::count());
    }

    public function test_the_seller_status_endpoint_separates_approval_from_verification(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $body = $this->getJson('/api/shop/seller/status')->assertOk()->json();

        $this->assertSame('pending', $body['seller']['status']);
        $this->assertFalse($body['seller']['can_publish']);
        $this->assertSame('none', $body['verification']['status']);
        $this->assertFalse($body['verification']['is_verified']);
        // Verification cannot even be applied for until trading is allowed.
        $this->assertFalse($body['verification']['can_apply']);
        $this->assertCount(2, $body['verification']['requirements']);
    }

    public function test_a_seller_cannot_promote_themselves_through_the_store_endpoint(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $this->post('/api/shop/seller/store', [
            'business_name'       => 'Renamed Store',
            'is_approved'         => true,
            'seller_status'       => 'approved',
            'is_verified'         => true,
            'verification_status' => 'verified',
        ])->assertOk();

        $this->vendor->refresh();

        // The name they own changed; every state they do not own did not.
        $this->assertSame('Renamed Store', $this->vendor->business_name);
        $this->assertFalse((bool) $this->vendor->is_approved);
        $this->assertSame('pending', $this->vendor->seller_status);
        $this->assertFalse((bool) $this->vendor->is_verified);
        $this->assertSame('none', $this->vendor->verification_status);
    }

    public function test_verification_requires_approval_first(): void
    {
        Sanctum::actingAs($this->sellerUser);

        $this->postJson('/api/shop/seller/verification')->assertStatus(403);
        $this->assertSame('none', $this->vendor->fresh()->verification_status);
    }

    public function test_verification_cannot_be_submitted_with_required_documents_missing(): void
    {
        $this->vendor->update(['is_approved' => true, 'seller_status' => 'approved']);
        Sanctum::actingAs($this->sellerUser);

        $this->postJson('/api/shop/seller/verification')
            ->assertStatus(422)
            ->assertJsonPath('missing.0', 'National ID (NIDA)');

        $this->assertSame('none', $this->vendor->fresh()->verification_status);
    }

    public function test_the_full_verification_journey_ends_with_an_admin_granting_the_badge(): void
    {
        $this->vendor->update(['is_approved' => true, 'seller_status' => 'approved']);
        Sanctum::actingAs($this->sellerUser);

        $nida = VerificationRequirement::where('name', 'National ID (NIDA)')->first();

        $this->post('/api/shop/seller/documents', [
            'requirement_id' => $nida->id,
            'file'           => UploadedFile::fake()->image('nida.jpg'),
        ])->assertOk();

        $this->assertDatabaseHas('vendor_documents', [
            'vendor_id' => $this->vendor->id,
            'verification_requirement_id' => $nida->id,
            'status' => 'pending',
        ]);

        $this->postJson('/api/shop/seller/verification')->assertOk();

        $this->vendor->refresh();
        $this->assertSame('pending', $this->vendor->verification_status);
        // Submitting paperwork must never be enough on its own.
        $this->assertFalse((bool) $this->vendor->is_verified);

        // The administrator's decision is what grants it.
        $this->vendor->update([
            'is_verified' => true, 'verification_status' => 'verified', 'verified_at' => now(),
        ]);

        // A real request re-hydrates the user and its relations; the test
        // holds one in-memory instance, so the cached relation is dropped
        // here to reproduce that rather than assert against a stale copy.
        $this->sellerUser->unsetRelation('vendor');

        $body = $this->getJson('/api/shop/seller/status')->json();
        $this->assertTrue($body['verification']['is_verified']);
        $this->assertSame('verified', $body['verification']['status']);
    }

    public function test_a_file_requirement_rejects_a_text_only_submission(): void
    {
        $this->vendor->update(['is_approved' => true, 'seller_status' => 'approved']);
        Sanctum::actingAs($this->sellerUser);

        $nida = VerificationRequirement::where('name', 'National ID (NIDA)')->first();

        $this->postJson('/api/shop/seller/documents', [
            'requirement_id' => $nida->id,
            'value'          => 'just some text',
        ])->assertStatus(422);

        $this->assertSame(0, \App\Models\VendorDocument::count());
    }

    public function test_the_storefront_badge_follows_verification_not_approval(): void
    {
        $this->vendor->update(['is_approved' => true, 'seller_status' => 'approved']);
        Sanctum::actingAs($this->sellerUser);
        $this->post('/api/products', $this->productPayload());

        $product = \App\Models\Product::first();

        $vendor = $this->getJson("/api/shop/products/{$product->id}")->json('product.vendor');
        $this->assertTrue($vendor['is_approved']);
        $this->assertFalse($vendor['is_verified']);

        $this->vendor->update(['is_verified' => true, 'verification_status' => 'verified']);

        $vendor = $this->getJson("/api/shop/products/{$product->id}")->json('product.vendor');
        $this->assertTrue($vendor['is_verified']);
    }

    public function test_a_guest_cannot_reach_seller_endpoints(): void
    {
        $this->getJson('/api/shop/seller/status')->assertStatus(401);
        $this->postJson('/api/shop/seller/verification')->assertStatus(401);
    }

    public function test_a_customer_without_a_store_is_refused(): void
    {
        $customer = User::create([
            'name' => 'Shopper', 'email' => 'shopper@test.local',
            'password' => bcrypt('password'), 'role' => 'user',
        ]);
        Sanctum::actingAs($customer);

        $this->getJson('/api/shop/seller/status')->assertStatus(403);
    }
}
