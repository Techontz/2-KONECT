<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\ProductVariant;
use App\Models\ProductVariantOption;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Quantity tiers and selectable variants.
 *
 * The point of most of these is that the *server* decides. A shopper can post
 * any quantity, any variant id and any price they like; what they are charged
 * is worked out here from rows in the database, and these assertions are what
 * keeps that true.
 */
class BulkPricingAndVariantsTest extends TestCase
{
    use RefreshDatabase;

    private Product $plain;
    private Product $bulk;
    private Product $optioned;
    private Attribute $colour;
    private Attribute $storage;
    private AttributeValue $black;
    private AttributeValue $blue;
    private AttributeValue $g128;
    private AttributeValue $g256;
    private User $shopper;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'tiers-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000021',
        ]);

        $vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Tier Test Store',
            'phone' => '0700000021', 'is_approved' => true,
        ]);

        $category = Category::create(['name' => 'Electronics']);
        $subcategory = Subcategory::create(['category_id' => $category->id, 'name' => 'Phones']);

        $make = fn (string $name, int $stock) => Product::create([
            'vendor_id' => $vendor->id, 'category_id' => $category->id,
            'subcategory_id' => $subcategory->id, 'name' => $name,
            'new_price' => 1000, 'stock' => $stock,
            'availability' => 'local', 'source_country' => 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);

        $this->plain    = $make('Plain Product', 12);
        $this->bulk     = $make('Bulk Product', 5000);
        $this->optioned = $make('Optioned Product', 50);

        foreach ([[1, 4, 500], [5, 10, 400], [11, 100, 350], [101, 1000, 300], [1001, null, 250]] as [$min, $max, $price]) {
            ProductPriceTier::create([
                'product_id' => $this->bulk->id, 'min_quantity' => $min,
                'max_quantity' => $max, 'unit_price' => $price,
            ]);
        }

        $this->colour  = Attribute::create(['name' => 'Colour', 'input_type' => 'select', 'is_active' => true, 'sort_order' => 1]);
        $this->storage = Attribute::create(['name' => 'Storage', 'input_type' => 'select', 'is_active' => true, 'sort_order' => 2]);
        $this->black = AttributeValue::create(['attribute_id' => $this->colour->id, 'value' => 'Black', 'sort_order' => 1]);
        $this->blue  = AttributeValue::create(['attribute_id' => $this->colour->id, 'value' => 'Blue', 'sort_order' => 2]);
        $this->g128  = AttributeValue::create(['attribute_id' => $this->storage->id, 'value' => '128GB', 'sort_order' => 1]);
        $this->g256  = AttributeValue::create(['attribute_id' => $this->storage->id, 'value' => '256GB', 'sort_order' => 2]);

        // Black+128 has stock and its own price; Blue+256 inherits the
        // product's; Blue+128 is sold out.
        $this->variant($this->black, $this->g128, 8, 850000);
        $this->variant($this->blue, $this->g256, 4, null);
        $this->variant($this->blue, $this->g128, 0, 850000);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'tiers-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'customer', 'phone' => '0700000022',
        ]);
    }

    private function variant(AttributeValue $colour, AttributeValue $storage, int $stock, ?float $price): ProductVariant
    {
        $variant = ProductVariant::create([
            'product_id' => $this->optioned->id, 'stock' => $stock,
            'price' => $price, 'is_active' => true,
        ]);

        ProductVariantOption::create([
            'product_variant_id' => $variant->id,
            'attribute_id' => $this->colour->id, 'attribute_value_id' => $colour->id,
        ]);
        ProductVariantOption::create([
            'product_variant_id' => $variant->id,
            'attribute_id' => $this->storage->id, 'attribute_value_id' => $storage->id,
        ]);

        return $variant;
    }

    private function quote(array $items): array
    {
        return $this->postJson('/api/shop/cart/quote', ['items' => $items])->assertOk()->json();
    }

    /* ---------------- A. an ordinary product ---------------- */

    public function test_a_product_with_no_tiers_or_options_is_unchanged(): void
    {
        $card = $this->getJson('/api/shop/products?per_page=60')->assertOk()->json('products');
        $plain = collect($card)->firstWhere('id', $this->plain->id);

        $this->assertSame(12, $plain['stock'], 'The card carries the real stock number.');
        $this->assertTrue($plain['in_stock']);
        $this->assertFalse($plain['has_bulk_pricing']);
        $this->assertFalse($plain['has_options']);

        $detail = $this->getJson("/api/shop/products/{$this->plain->id}")->assertOk()->json('product');
        $this->assertSame([], $detail['price_tiers']);
        $this->assertSame([], $detail['options']);
        $this->assertSame([], $detail['variants']);

        // And it prices at its ordinary price, at any quantity.
        $quote = $this->quote([['product_id' => $this->plain->id, 'quantity' => 3]]);
        $this->assertEquals(1000, $quote['lines'][0]['unit_price']['current']);
        $this->assertEquals(3000, $quote['lines'][0]['total']['current']);
        $this->assertTrue($quote['can_checkout']);
    }

    /* ---------------- B. out of stock ---------------- */

    public function test_an_out_of_stock_product_cannot_be_bought(): void
    {
        $this->plain->update(['stock' => 0]);

        $quote = $this->quote([['product_id' => $this->plain->id, 'quantity' => 1]]);

        $this->assertFalse($quote['lines'][0]['purchasable']);
        $this->assertFalse($quote['can_checkout']);
        $this->assertStringContainsString('out of stock', $quote['lines'][0]['reason']);

        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->plain->id, 'quantity' => 1]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);
    }

    /* ---------------- C. quantity tiers ---------------- */

    public static function tierBoundaries(): array
    {
        return [
            'first tier, one unit'     => [1, 500.0],
            'first tier, top edge'     => [4, 500.0],
            'second tier, bottom edge' => [5, 400.0],
            'second tier, top edge'    => [10, 400.0],
            'third tier, bottom edge'  => [11, 350.0],
            'third tier, top edge'     => [100, 350.0],
            'fourth tier, bottom edge' => [101, 300.0],
            'fourth tier, top edge'    => [1000, 300.0],
            'open-ended tier'          => [1001, 250.0],
            'far into the open tier'   => [5000, 250.0],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('tierBoundaries')]
    public function test_each_quantity_lands_in_the_right_tier(int $quantity, float $expected): void
    {
        $quote = $this->quote([['product_id' => $this->bulk->id, 'quantity' => $quantity]]);
        $line = $quote['lines'][0];

        $this->assertEquals($expected, $line['unit_price']['current'], "{$quantity} units should cost {$expected} each.");
        $this->assertEquals($expected * $quantity, $line['total']['current']);
        $this->assertNotNull($line['tier']);
    }

    public function test_the_order_charges_the_tier_price_not_the_browsers(): void
    {
        Sanctum::actingAs($this->shopper);

        $response = $this->postJson('/api/shop/orders', [
            // Seven units falls in the 5-10 tier at 400 each.
            'items' => [['product_id' => $this->bulk->id, 'quantity' => 7, 'price' => 1]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated();

        $line = \App\Models\Order::where('reference', $response->json('reference'))->first();

        $this->assertSame('400.00', $line->price, 'The unit price comes from the tier, not the request.');
        $this->assertSame('2800.00', $line->total);
    }

    /* ---------------- D. options and variants ---------------- */

    public function test_the_detail_payload_describes_the_options_and_every_combination(): void
    {
        $detail = $this->getJson("/api/shop/products/{$this->optioned->id}")->assertOk()->json('product');

        $this->assertCount(2, $detail['options'], 'Two axes: colour and storage.');
        $names = collect($detail['options'])->pluck('name')->all();
        $this->assertEqualsCanonicalizing(['Colour', 'Storage'], $names);

        $this->assertCount(3, $detail['variants']);

        $inherits = collect($detail['variants'])->firstWhere('stock', 4);
        $this->assertEquals(1000, $inherits['price']['current'], 'A variant with no price of its own inherits the product price.');

        $soldOut = collect($detail['variants'])->firstWhere('stock', 0);
        $this->assertFalse($soldOut['in_stock']);
    }

    public function test_a_variant_price_and_stock_are_used_rather_than_the_products(): void
    {
        $variant = ProductVariant::where('product_id', $this->optioned->id)->where('stock', 8)->first();

        $quote = $this->quote([[
            'product_id' => $this->optioned->id, 'variant_id' => $variant->id, 'quantity' => 2,
        ]]);

        $this->assertEquals(850000, $quote['lines'][0]['unit_price']['current']);
        $this->assertSame(8, $quote['lines'][0]['stock'], 'The variant counts its own stock, not the product\'s 50.');
    }

    /* ---------------- E. combinations that cannot be bought ---------------- */

    public function test_a_sold_out_combination_is_refused(): void
    {
        $soldOut = ProductVariant::where('product_id', $this->optioned->id)->where('stock', 0)->first();

        $quote = $this->quote([[
            'product_id' => $this->optioned->id, 'variant_id' => $soldOut->id, 'quantity' => 1,
        ]]);

        $this->assertFalse($quote['lines'][0]['purchasable']);
        $this->assertFalse($quote['can_checkout']);

        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->optioned->id, 'variant_id' => $soldOut->id, 'quantity' => 1]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);
    }

    public function test_more_than_a_variant_holds_is_refused(): void
    {
        $variant = ProductVariant::where('product_id', $this->optioned->id)->where('stock', 8)->first();

        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->optioned->id, 'variant_id' => $variant->id, 'quantity' => 9]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);
    }

    public function test_a_product_that_sells_by_option_refuses_an_order_with_none_chosen(): void
    {
        Sanctum::actingAs($this->shopper);

        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->optioned->id, 'quantity' => 1]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);
    }

    public function test_a_variant_belonging_to_another_product_is_not_honoured(): void
    {
        $variant = ProductVariant::where('product_id', $this->optioned->id)->where('stock', 8)->first();

        Sanctum::actingAs($this->shopper);

        // Posting another product's variant must not buy this one at that price.
        $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->plain->id, 'variant_id' => $variant->id, 'quantity' => 1]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertStatus(422);
    }

    /* ---------------- ordering and stock movement ---------------- */

    public function test_buying_a_variant_takes_the_stock_from_that_variant_and_cancelling_returns_it(): void
    {
        $variant = ProductVariant::where('product_id', $this->optioned->id)->where('stock', 8)->first();
        $productStock = $this->optioned->stock;

        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->optioned->id, 'variant_id' => $variant->id, 'quantity' => 3]],
            'delivery_address' => 'Somewhere', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ])->assertCreated()->json('reference');

        $this->assertSame(5, $variant->fresh()->stock, 'Three came off the variant.');
        $this->assertSame($productStock, $this->optioned->fresh()->stock, 'The product\'s own count is untouched.');

        // The order remembers which combination it was for.
        $line = \App\Models\Order::where('reference', $reference)->first();
        $this->assertSame($variant->id, $line->product_variant_id);

        $this->postJson("/api/shop/orders/{$reference}/cancel")->assertOk();

        $this->assertSame(8, $variant->fresh()->stock, 'Cancelling puts them back on the variant.');
    }

    /* ---------------- tier validation ---------------- */

    public function test_overlapping_tiers_are_refused(): void
    {
        $this->expectException(\Illuminate\Validation\ValidationException::class);

        \App\Support\PriceTierRules::normalise([
            ['min_quantity' => 1, 'max_quantity' => 10, 'unit_price' => 500],
            ['min_quantity' => 5, 'max_quantity' => 20, 'unit_price' => 400],
        ]);
    }

    public function test_only_the_last_tier_may_be_open_ended(): void
    {
        $this->expectException(\Illuminate\Validation\ValidationException::class);

        \App\Support\PriceTierRules::normalise([
            ['min_quantity' => 1, 'max_quantity' => null, 'unit_price' => 500],
            ['min_quantity' => 50, 'max_quantity' => 100, 'unit_price' => 400],
        ]);
    }

    public function test_valid_tiers_come_back_sorted_and_normalised(): void
    {
        $tiers = \App\Support\PriceTierRules::normalise([
            ['min_quantity' => 11, 'max_quantity' => '', 'unit_price' => '350'],
            ['min_quantity' => '1', 'max_quantity' => 10, 'unit_price' => 500],
        ]);

        $this->assertSame(1, $tiers[0]['min_quantity']);
        $this->assertSame(10, $tiers[0]['max_quantity']);
        $this->assertNull($tiers[1]['max_quantity'], 'A blank maximum becomes open-ended.');
    }
}
