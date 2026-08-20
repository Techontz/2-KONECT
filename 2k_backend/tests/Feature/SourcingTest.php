<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductRequest;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorApplication;
use App\Support\OrderJourney;
use App\Support\Sourcing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The distinction 2KONECT is built around: local stock versus imported stock,
 * and everything that follows from it — filtering, pricing, the promise made
 * at checkout, the journey afterwards, and the last mile.
 */
class SourcingTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Product $local;
    private Product $imported;
    private User $shopper;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'seller@sourcing.test',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000001',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Test Store',
            'phone' => '0700000001', 'is_approved' => true,
        ]);

        $category = Category::create(['name' => 'Electronics']);

        $this->local = Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $category->id,
            'name' => 'Local Phone', 'new_price' => 500000, 'stock' => 4,
            'availability' => Sourcing::LOCAL, 'source_country' => 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);

        $this->imported = Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $category->id,
            'name' => 'Imported Phone', 'new_price' => 350000, 'stock' => 0,
            'availability' => Sourcing::IMPORT, 'source_country' => 'CN',
            'shipping_method' => 'air', 'lead_time_min_days' => 8, 'lead_time_max_days' => 14,
        ]);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'shopper@sourcing.test',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000002',
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* Catalogue                                                        */
    /* ---------------------------------------------------------------- */

    public function test_every_card_says_where_the_product_is(): void
    {
        $response = $this->getJson('/api/shop/products')->assertOk();

        $cards = collect($response->json('products'))->keyBy('name');

        $this->assertSame('local', $cards['Local Phone']['sourcing']['type']);
        $this->assertSame('In Tanzania', $cards['Local Phone']['sourcing']['label']);
        $this->assertSame('1–3 days', $cards['Local Phone']['sourcing']['lead_time']['label']);

        $this->assertSame('import', $cards['Imported Phone']['sourcing']['type']);
        $this->assertSame('CN', $cards['Imported Phone']['sourcing']['origin']['code']);
        $this->assertSame('Air freight', $cards['Imported Phone']['sourcing']['shipping_method']['label']);
    }

    public function test_availability_filter_splits_the_catalogue(): void
    {
        $local = $this->getJson('/api/shop/products?availability=local')->assertOk();
        $this->assertSame(1, $local->json('meta.total'));
        $this->assertSame('Local Phone', $local->json('products.0.name'));

        $import = $this->getJson('/api/shop/products?availability=import')->assertOk();
        $this->assertSame(1, $import->json('meta.total'));
        $this->assertSame('Imported Phone', $import->json('products.0.name'));
    }

    public function test_facets_report_both_sides_of_the_toggle(): void
    {
        $filters = $this->getJson('/api/shop/products?availability=local')->json('filters');

        $counts = collect($filters['availability'])->keyBy('value');

        // Counts ignore the availability filter itself, so a shopper can always
        // see how much sits on the other side.
        $this->assertSame(1, $counts['local']['count']);
        $this->assertSame(1, $counts['import']['count']);

        $this->assertContains('CN', array_column($filters['origins'], 'code'));
    }

    public function test_delivery_time_filter_uses_the_promised_window(): void
    {
        $fast = $this->getJson('/api/shop/products?max_days=3')->assertOk();

        $this->assertSame(1, $fast->json('meta.total'));
        $this->assertSame('Local Phone', $fast->json('products.0.name'));
    }

    public function test_a_product_can_offer_a_second_way_to_buy(): void
    {
        ProductOffer::create([
            'product_id' => $this->local->id, 'availability' => Sourcing::IMPORT,
            'source_country' => 'AE', 'price' => 380000, 'stock' => 0,
            'lead_time_min_days' => 5, 'lead_time_max_days' => 9, 'is_active' => true,
        ]);

        $options = $this->getJson("/api/shop/products/{$this->local->id}")
            ->assertOk()
            ->json('product.buying_options');

        $this->assertCount(2, $options);
        $this->assertNull($options[0]['id'], 'the product row is always the first option');
        $this->assertEquals(500000, $options[0]['price']['current']);
        $this->assertEquals(380000, $options[1]['price']['current']);
        // An import is bought to order, so no local stock does not make it
        // unbuyable — that is the whole point of the cheaper option.
        $this->assertTrue($options[1]['in_stock']);
    }

    /* ---------------------------------------------------------------- */
    /* Checkout                                                         */
    /* ---------------------------------------------------------------- */

    public function test_an_imported_product_sells_without_local_stock(): void
    {
        Sanctum::actingAs($this->shopper);

        $response = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 2]],
            'delivery_address' => 'Mikocheni, Dar es Salaam',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated();

        $order = $response->json('order');

        $this->assertSame('import', $order['fulfilment']['type']);
        $this->assertSame('CN', $order['fulfilment']['origin']['code']);
        $this->assertSame(14, $order['fulfilment']['eta']['max']);
        $this->assertSame(
            now()->addDays(14)->toDateString(),
            $order['fulfilment']['estimated_arrival_at'],
        );

        // Nothing was decremented: there was nothing on a shelf to decrement.
        $this->assertSame(0, $this->imported->fresh()->stock);
    }

    public function test_local_stock_still_cannot_be_oversold(): void
    {
        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->local->id, 'quantity' => 9]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);

        $this->assertSame(4, $this->local->fresh()->stock);
    }

    public function test_buying_the_imported_option_records_its_price_and_date(): void
    {
        $offer = ProductOffer::create([
            'product_id' => $this->local->id, 'availability' => Sourcing::IMPORT,
            'source_country' => 'AE', 'price' => 380000, 'stock' => 0,
            'lead_time_min_days' => 5, 'lead_time_max_days' => 9, 'is_active' => true,
        ]);

        Sanctum::actingAs($this->shopper);

        $order = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->local->id, 'quantity' => 1, 'offer_id' => $offer->id]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order');

        $this->assertEquals(380000, $order['items'][0]['price']);
        $this->assertSame('import', $order['fulfilment']['type']);
        $this->assertSame('AE', $order['fulfilment']['origin']['code']);
        // The local shelf is untouched: this unit was never taken from it.
        $this->assertSame(4, $this->local->fresh()->stock);
    }

    public function test_an_offer_from_another_product_is_refused(): void
    {
        $stranger = ProductOffer::create([
            'product_id' => $this->imported->id, 'availability' => Sourcing::IMPORT,
            'price' => 1, 'stock' => 0, 'is_active' => true,
        ]);

        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->local->id, 'quantity' => 1, 'offer_id' => $stranger->id]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);
    }

    /* ---------------------------------------------------------------- */
    /* The journey                                                      */
    /* ---------------------------------------------------------------- */

    public function test_a_new_order_opens_its_timeline_at_the_first_stop(): void
    {
        Sanctum::actingAs($this->shopper);

        $order = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order');

        $states = collect($order['timeline'])->pluck('state', 'status');

        // An import shows all nine stops from the moment it is placed.
        $this->assertCount(9, $order['timeline']);
        $this->assertSame('current', $states['pending']);
        $this->assertSame('upcoming', $states['in_transit']);

        $this->assertDatabaseHas('order_events', [
            'reference' => $order['reference'],
            'status' => 'pending',
        ]);
    }

    public function test_a_local_order_takes_the_short_route(): void
    {
        Sanctum::actingAs($this->shopper);

        $order = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->local->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order');

        $stops = collect($order['timeline'])->pluck('status')->all();

        $this->assertSame(
            ['pending', 'processing', 'shipped', 'out_for_delivery', 'completed'],
            $stops,
        );
    }

    public function test_a_step_is_only_done_once_the_order_has_passed_it(): void
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order.reference');

        // A stray event recorded against a later stop must not make the
        // journey look further along than the order actually is.
        OrderEvent::create([
            'reference' => $reference,
            'status' => OrderJourney::ARRIVED,
            'title' => 'Note',
            'happened_at' => now(),
        ]);

        $states = collect($this->getJson("/api/shop/orders/{$reference}")->json('order.timeline'))
            ->pluck('state', 'status');

        $this->assertSame('current', $states['pending']);
        $this->assertSame('upcoming', $states['arrived_tz']);
    }

    public function test_the_timeline_speaks_in_the_right_tense(): void
    {
        Sanctum::actingAs($this->shopper);

        $timeline = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order.timeline');

        $steps = collect($timeline)->keyBy('status');

        // A stop the order has passed reads as something that happened; one it
        // has not reached reads as something that will. Telling a buyer their
        // package "has arrived in Tanzania" while it is still at the supplier
        // is how a tracking screen loses their trust.
        // The recorded event's own note wins on a stop that happened — it is
        // what actually occurred, and it carries detail the generic line cannot.
        $this->assertSame('Order received. Payment on delivery.', $steps['pending']['note']);
        $this->assertSame('Your package will land in Tanzania.', $steps['arrived_tz']['note']);
        $this->assertSame('A rider will bring your package to you.', $steps['out_for_delivery']['note']);

        // And nothing a shopper reads is a status constant.
        foreach ($timeline as $step) {
            $this->assertStringNotContainsString('_', $step['title']);
            $this->assertMatchesRegularExpression('/^[A-Z]/', $step['title']);
        }
    }

    public function test_a_seller_walks_an_import_through_its_own_route(): void
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order.reference');

        $line = Order::where('reference', $reference)->firstOrFail();

        Sanctum::actingAs($this->vendor->user);

        $this->postJson("/api/shop/vendor/orders/{$line->id}/status", [
            'status' => 'dispatched',
            'location' => 'Shenzhen',
        ])->assertOk();

        $rows = $this->getJson('/api/shop/vendor/orders')->json('orders');
        $row  = collect($rows)->firstWhere('id', $line->id);

        $this->assertSame('import', $row['fulfilment_type']);
        // The next stop is the import route's, not the local one's.
        $this->assertSame('in_transit', $row['next_status']['value']);

        $this->assertDatabaseHas('order_events', [
            'reference' => $reference,
            'status' => 'dispatched',
            'location' => 'Shenzhen',
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* The last mile                                                    */
    /* ---------------------------------------------------------------- */

    public function test_delivery_cannot_be_arranged_before_the_shipment_lands(): void
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order.reference');

        $this->getJson("/api/shop/orders/{$reference}/delivery-options")
            ->assertOk()
            ->assertJsonPath('available', false);

        $this->postJson('/api/shop/deliveries', [
            'order_reference' => $reference,
            'mode' => 'delivery',
            'recipient_name' => 'Shopper',
            'recipient_phone' => '0700000002',
            'address' => 'Mikocheni',
        ])->assertStatus(422);
    }

    public function test_delivery_is_arranged_once_it_has_landed(): void
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order.reference');

        Order::where('reference', $reference)->update(['status' => OrderJourney::ARRIVED]);

        $this->postJson('/api/shop/deliveries', [
            'order_reference' => $reference,
            'mode' => 'pickup',
            'recipient_name' => 'Shopper',
            'recipient_phone' => '0700000002',
            'pickup_point' => '2KONECT Kariakoo Hub',
        ])->assertCreated();

        $order = $this->getJson("/api/shop/orders/{$reference}")->json('order');

        $this->assertFalse($order['can_request_delivery'], 'a second job must not be openable');
        $this->assertSame('pickup', $order['delivery_request']['mode']);
        $this->assertEquals(0, $order['delivery_request']['fee']);
    }

    public function test_one_shopper_cannot_arrange_delivery_for_another(): void
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->imported->id, 'quantity' => 1]],
            'delivery_address' => 'Mikocheni',
            'customer_phone' => '0700000002',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('order.reference');

        Order::where('reference', $reference)->update(['status' => OrderJourney::ARRIVED]);

        $intruder = User::create([
            'name' => 'Someone Else', 'email' => 'other@sourcing.test',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000009',
        ]);

        Sanctum::actingAs($intruder);

        // The reference is not a password; ownership decides.
        $this->postJson('/api/shop/deliveries', [
            'order_reference' => $reference,
            'mode' => 'pickup',
            'recipient_name' => 'Someone Else',
            'recipient_phone' => '0700000009',
            'pickup_point' => '2KONECT Kariakoo Hub',
        ])->assertNotFound();
    }

    /* ---------------------------------------------------------------- */
    /* Sourcing requests and seller applications                        */
    /* ---------------------------------------------------------------- */

    public function test_a_visitor_can_ask_us_to_source_something(): void
    {
        Storage::fake('public');

        $response = $this->post('/api/shop/requests', [
            'name' => 'DJI Mini 4 Pro',
            'quantity' => 1,
            'contact_name' => 'Walk-in',
            'contact_phone' => '0700000003',
            'image' => UploadedFile::fake()->image('drone.jpg'),
        ])->assertCreated();

        $this->assertStringStartsWith('2KR-', $response->json('request.reference'));
        $this->assertSame(1, $response->json('request.step'));

        $request = ProductRequest::firstOrFail();
        $this->assertNull($request->user_id, 'a visitor needs no account to ask');
        Storage::disk('public')->assertExists($request->image);
    }

    public function test_a_signed_in_request_lands_in_the_account(): void
    {
        Sanctum::actingAs($this->shopper);

        $this->post('/api/shop/requests', [
            'name' => 'Anker power bank',
            'quantity' => 2,
            'contact_name' => 'Shopper',
            'contact_phone' => '0700000002',
        ])->assertCreated();

        $this->getJson('/api/shop/requests')
            ->assertOk()
            ->assertJsonPath('requests.0.name', 'Anker power bank');
    }

    public function test_one_shopper_cannot_read_anothers_request(): void
    {
        $request = ProductRequest::create([
            'reference' => '2KR-PRIVATE', 'user_id' => $this->shopper->id,
            'name' => 'Private', 'quantity' => 1,
            'contact_name' => 'Shopper', 'contact_phone' => '0700000002',
        ]);

        $intruder = User::create([
            'name' => 'Nosy', 'email' => 'nosy@sourcing.test',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000008',
        ]);

        Sanctum::actingAs($intruder);

        $this->getJson("/api/shop/requests/{$request->reference}")->assertNotFound();
    }

    public function test_applying_to_sell_creates_a_case_not_a_seller(): void
    {
        $response = $this->postJson('/api/shop/vendor-applications', [
            'full_name' => 'Asha',
            'business_name' => 'Mwinyi Electronics',
            'phone' => '0700000004',
        ])->assertCreated();

        $this->assertStringStartsWith('2KV-', $response->json('application.reference'));

        $application = VendorApplication::firstOrFail();
        $this->assertSame('pending', $application->status);
        // The whole point: nobody becomes a seller by filling in a form.
        $this->assertNull($application->vendor_id);
        $this->assertSame(1, Vendor::count(), 'only the fixture seller exists');
    }

    public function test_a_second_application_updates_the_first(): void
    {
        $this->postJson('/api/shop/vendor-applications', [
            'full_name' => 'Asha', 'business_name' => 'Mwinyi Electronics', 'phone' => '0700000004',
        ])->assertCreated();

        $this->postJson('/api/shop/vendor-applications', [
            'full_name' => 'Asha', 'business_name' => 'Mwinyi Electronics Ltd', 'phone' => '0700000004',
        ])->assertOk();

        $this->assertSame(1, VendorApplication::count());
        $this->assertSame('Mwinyi Electronics Ltd', VendorApplication::first()->business_name);
    }
}
