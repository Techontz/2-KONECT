<?php

namespace Tests\Feature;

use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Category;
use App\Models\Order;
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
 * Real variant matrices: an iPhone, shoes and a laptop.
 *
 * The rule being defended throughout is that a combination is an independent
 * commercial unit. Its price is its own, its stock is its own, and neither is
 * derived from the parent by adding a difference to it.
 */
class VariantMatrixTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;
    private User $shopper;
    private array $axis = [];

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'matrix-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000031',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'Matrix Store',
            'phone' => '0700000031', 'is_approved' => true,
        ]);

        $this->category    = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);

        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'matrix-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'customer', 'phone' => '0700000032',
        ]);
    }

    /** An option axis and its values, from the existing attribute vocabulary. */
    private function axis(string $name, array $values): array
    {
        $attribute = $this->axis[$name] ??= Attribute::create([
            'name' => $name, 'input_type' => 'select', 'is_active' => true, 'sort_order' => count($this->axis) + 1,
        ]);

        $out = ['attribute' => $attribute, 'values' => []];

        foreach ($values as $index => $value) {
            $out['values'][$value] = AttributeValue::firstOrCreate(
                ['attribute_id' => $attribute->id, 'value' => $value],
                ['sort_order' => $index],
            );
        }

        return $out;
    }

    private function product(string $name, float $price, int $parentStock = 0): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $this->subcategory->id, 'name' => $name,
            'new_price' => $price, 'stock' => $parentStock,
            'availability' => 'local', 'source_country' => 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    /**
     * @param  array<int, array{0: array, 1: string}>  $choices  [axis, value] pairs
     */
    private function variant(Product $product, array $choices, ?float $price, int $stock, ?string $sku = null): ProductVariant
    {
        $variant = ProductVariant::create([
            'product_id' => $product->id, 'price' => $price,
            'stock' => $stock, 'sku' => $sku, 'is_active' => true,
        ]);

        foreach ($choices as [$axis, $value]) {
            ProductVariantOption::create([
                'product_variant_id' => $variant->id,
                'attribute_id'       => $axis['attribute']->id,
                'attribute_value_id' => $axis['values'][$value]->id,
            ]);
        }

        return $variant;
    }

    /** The exact iPhone matrix from the brief. */
    private function iphone(): array
    {
        $colour  = $this->axis('Color', ['Black', 'Blue']);
        $storage = $this->axis('Storage', ['128GB', '256GB']);

        // Parent stock zero on purpose: for a variant product the parent row
        // is not the inventory, and the catalogue must not read it as one.
        $phone = $this->product('iPhone 15', 1850000, 0);

        return [
            'product' => $phone,
            'colour'  => $colour,
            'storage' => $storage,
            'black128' => $this->variant($phone, [[$colour, 'Black'], [$storage, '128GB']], 1850000, 5, 'IP15-BLK-128'),
            'black256' => $this->variant($phone, [[$colour, 'Black'], [$storage, '256GB']], 2150000, 3, 'IP15-BLK-256'),
            'blue128'  => $this->variant($phone, [[$colour, 'Blue'],  [$storage, '128GB']], 1900000, 7, 'IP15-BLU-128'),
            'blue256'  => $this->variant($phone, [[$colour, 'Blue'],  [$storage, '256GB']], 2200000, 2, 'IP15-BLU-256'),
        ];
    }

    private function quote(array $items): array
    {
        return $this->postJson('/api/shop/cart/quote', ['items' => $items])->assertOk()->json();
    }

    private function order(array $items)
    {
        Sanctum::actingAs($this->shopper);

        return $this->postJson('/api/shop/orders', [
            'items' => $items,
            'delivery_address' => 'Dar es Salaam', 'customer_phone' => '0700000000',
            'payment_method' => 'cash_on_delivery',
        ]);
    }

    /* ================= B. the iPhone ================= */

    public function test_every_iphone_combination_quotes_its_own_price_and_stock(): void
    {
        $iphone = $this->iphone();

        $expected = [
            ['black128', 1850000, 5],
            ['black256', 2150000, 3],
            ['blue128',  1900000, 7],
            ['blue256',  2200000, 2],
        ];

        foreach ($expected as [$key, $price, $stock]) {
            $line = $this->quote([[
                'product_id' => $iphone['product']->id,
                'variant_id' => $iphone[$key]->id,
                'quantity'   => 1,
            ]])['lines'][0];

            $this->assertEquals($price, $line['unit_price']['current'], "{$key} must cost {$price}.");
            $this->assertSame($stock, $line['stock'], "{$key} must report its own stock.");
            $this->assertTrue($line['purchasable']);
        }
    }

    public function test_the_dearest_combination_is_never_priced_from_the_parent(): void
    {
        $iphone = $this->iphone();

        $line = $this->quote([[
            'product_id' => $iphone['product']->id,
            'variant_id' => $iphone['blue256']->id,
            'quantity'   => 1,
        ]])['lines'][0];

        $this->assertEquals(2200000, $line['unit_price']['current']);
        $this->assertNotEquals(
            (float) $iphone['product']->new_price,
            (float) $line['unit_price']['current'],
            'Blue 256GB costs 2,200,000 — the parent 1,850,000 must not leak through.',
        );
    }

    public function test_a_variant_product_reports_its_combined_stock_and_a_from_price(): void
    {
        $iphone = $this->iphone();

        $detail = $this->getJson("/api/shop/products/{$iphone['product']->id}")->assertOk()->json('product');

        // Seventeen units across four combinations, though the parent row is 0.
        $this->assertSame(17, $detail['stock']);
        $this->assertTrue($detail['in_stock']);

        $this->assertNotNull($detail['variant_summary']);
        $this->assertTrue($detail['variant_summary']['requires_selection']);
        $this->assertEquals(1850000, $detail['variant_summary']['price_from']);
        $this->assertEquals(2200000, $detail['variant_summary']['price_to']);
        $this->assertTrue($detail['variant_summary']['is_range']);

        // And the primary buying option agrees, rather than quoting the
        // parent's zero and rendering the page unavailable.
        $this->assertSame(17, $detail['buying_options'][0]['stock']);
        $this->assertTrue($detail['buying_options'][0]['in_stock']);
    }

    public function test_the_listing_card_shows_combined_stock_and_flags_a_from_price(): void
    {
        $iphone = $this->iphone();

        $cards = $this->getJson('/api/shop/products?per_page=60')->assertOk()->json('products');
        $card  = collect($cards)->firstWhere('id', $iphone['product']->id);

        $this->assertSame(17, $card['stock'], 'A grid must not call a fully stocked product sold out.');
        $this->assertTrue($card['in_stock']);
        $this->assertFalse($card['badges']['out_of_stock']);
        $this->assertTrue($card['price_from'], 'The card says "from", because the choice changes the price.');
        $this->assertEquals(1850000, $card['price']['current']);
        $this->assertTrue($card['has_options']);
    }

    /* ================= C. shoes ================= */

    public function test_shoes_track_stock_per_colour_and_size(): void
    {
        $colour = $this->axis('Color', ['Black', 'White']);
        $size   = $this->axis('Shoe size', ['41', '42', '43']);

        $shoe = $this->product('Running Shoe', 120000, 0);

        // All one price; only the stock differs. The price is left null so
        // every row inherits, which is the ordinary clothing case.
        $black42 = $this->variant($shoe, [[$colour, 'Black'], [$size, '42']], null, 4);
        $white43 = $this->variant($shoe, [[$colour, 'White'], [$size, '43']], null, 1);
        $this->variant($shoe, [[$colour, 'Black'], [$size, '41']], null, 0);

        $detail = $this->getJson("/api/shop/products/{$shoe->id}")->assertOk()->json('product');

        $this->assertSame(5, $detail['stock'], 'Four plus one plus none.');
        $this->assertFalse($detail['variant_summary']['is_range'], 'Every size costs the same, so there is no range.');
        $this->assertEquals(120000, $detail['variant_summary']['price_from']);

        // An inheriting variant is priced at the product's figure, not null.
        $line = $this->quote([['product_id' => $shoe->id, 'variant_id' => $black42->id, 'quantity' => 2]])['lines'][0];
        $this->assertEquals(120000, $line['unit_price']['current']);
        $this->assertEquals(240000, $line['total']['current']);

        // And the size with one pair left refuses two.
        $short = $this->quote([['product_id' => $shoe->id, 'variant_id' => $white43->id, 'quantity' => 2]])['lines'][0];
        $this->assertFalse($short['purchasable']);
        $this->assertStringContainsString('Only 1 left', $short['reason']);
    }

    /* ================= D. laptop ================= */

    public function test_a_laptop_prices_each_ram_and_storage_pair_independently(): void
    {
        $ram     = $this->axis('RAM', ['8GB', '16GB']);
        $storage = $this->axis('Storage', ['256GB', '512GB']);

        $laptop = $this->product('Laptop Pro', 2000000, 0);

        $matrix = [
            ['8GB', '256GB', 2000000, 4],
            ['8GB', '512GB', 2300000, 2],
            ['16GB', '256GB', 2600000, 3],
            ['16GB', '512GB', 2900000, 1],
        ];

        $made = [];
        foreach ($matrix as [$r, $s, $price, $stock]) {
            $made[] = [$this->variant($laptop, [[$ram, $r], [$storage, $s]], $price, $stock), $price, $stock];
        }

        foreach ($made as [$variant, $price, $stock]) {
            $line = $this->quote([['product_id' => $laptop->id, 'variant_id' => $variant->id, 'quantity' => 1]])['lines'][0];
            $this->assertEquals($price, $line['unit_price']['current']);
            $this->assertSame($stock, $line['stock']);
        }

        $detail = $this->getJson("/api/shop/products/{$laptop->id}")->assertOk()->json('product');
        $this->assertEquals(2000000, $detail['variant_summary']['price_from']);
        $this->assertEquals(2900000, $detail['variant_summary']['price_to']);
    }

    /* ================= F. combinations that are not sold ================= */

    public function test_a_combination_the_seller_does_not_sell_simply_does_not_exist(): void
    {
        $colour  = $this->axis('Color', ['Black', 'Blue']);
        $storage = $this->axis('Storage', ['128GB', '256GB']);

        $phone = $this->product('Partial Phone', 500000, 0);

        // Three of the four pairs. Blue + 256GB is not sold.
        $this->variant($phone, [[$colour, 'Black'], [$storage, '128GB']], 500000, 2);
        $this->variant($phone, [[$colour, 'Black'], [$storage, '256GB']], 600000, 2);
        $this->variant($phone, [[$colour, 'Blue'],  [$storage, '128GB']], 550000, 2);

        $detail = $this->getJson("/api/shop/products/{$phone->id}")->assertOk()->json('product');

        $this->assertCount(3, $detail['variants'], 'Only the pairs actually sold are listed.');

        // Both values still appear on their axis, so the selector can show
        // Blue and 256GB and mark the pair of them unreachable.
        $values = collect($detail['options'])->flatMap(fn ($axis) => collect($axis['values'])->pluck('value'))->all();
        $this->assertContains('Blue', $values);
        $this->assertContains('256GB', $values);
    }

    /* ================= G. duplicates ================= */

    public function test_the_backend_refuses_a_duplicate_combination(): void
    {
        $colour  = $this->axis('Color', ['Blue']);
        $storage = $this->axis('Storage', ['256GB']);
        $phone   = $this->product('Dup Phone', 500000, 0);

        Sanctum::actingAs(User::where('email', 'matrix-seller@test.local')->first());

        $this->postJson("/api/products/{$phone->id}", [
            '_method'  => 'PATCH',
            'variants' => [
                ['stock' => 2, 'price' => 500000, 'options' => [
                    ['attribute_id' => $colour['attribute']->id, 'attribute_value_id' => $colour['values']['Blue']->id],
                    ['attribute_id' => $storage['attribute']->id, 'attribute_value_id' => $storage['values']['256GB']->id],
                ]],
                ['stock' => 9, 'price' => 900000, 'options' => [
                    ['attribute_id' => $colour['attribute']->id, 'attribute_value_id' => $colour['values']['Blue']->id],
                    ['attribute_id' => $storage['attribute']->id, 'attribute_value_id' => $storage['values']['256GB']->id],
                ]],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, ProductVariant::where('product_id', $phone->id)->count(), 'Nothing is written when the set is rejected.');
    }

    public function test_a_value_filed_under_the_wrong_axis_is_refused(): void
    {
        $colour  = $this->axis('Color', ['Blue']);
        $storage = $this->axis('Storage', ['256GB']);
        $phone   = $this->product('Wrong Axis Phone', 500000, 0);

        Sanctum::actingAs(User::where('email', 'matrix-seller@test.local')->first());

        $this->postJson("/api/products/{$phone->id}", [
            '_method'  => 'PATCH',
            'variants' => [
                // "256GB" filed under Colour.
                ['stock' => 2, 'price' => 500000, 'options' => [
                    ['attribute_id' => $colour['attribute']->id, 'attribute_value_id' => $storage['values']['256GB']->id],
                ]],
            ],
        ])->assertStatus(422);
    }

    /* ================= J. tiers alongside a variant price ================= */

    public function test_a_product_tier_never_undercuts_a_variant_that_prices_itself(): void
    {
        $iphone = $this->iphone();

        // A tempting product-level tier. It must not touch a combination that
        // names its own price — 250,000 for a 2,200,000 phone would be a
        // catastrophic mispricing.
        ProductPriceTier::create([
            'product_id' => $iphone['product']->id,
            'min_quantity' => 1, 'max_quantity' => null, 'unit_price' => 250000,
        ]);

        $line = $this->quote([[
            'product_id' => $iphone['product']->id,
            'variant_id' => $iphone['blue256']->id,
            'quantity'   => 2,
        ]])['lines'][0];

        $this->assertEquals(2200000, $line['unit_price']['current'], 'The variant price stands.');
        $this->assertNull($line['tier'], 'And the page is told no tier applied, so it shows none.');
    }

    public function test_a_tier_does_apply_to_a_variant_that_inherits_the_product_price(): void
    {
        $colour = $this->axis('Color', ['Black']);
        $size   = $this->axis('Shoe size', ['42']);
        $shirt  = $this->product('Plain Shirt', 20000, 0);

        $variant = $this->variant($shirt, [[$colour, 'Black'], [$size, '42']], null, 100);

        ProductPriceTier::create(['product_id' => $shirt->id, 'min_quantity' => 1, 'max_quantity' => 9, 'unit_price' => 20000]);
        ProductPriceTier::create(['product_id' => $shirt->id, 'min_quantity' => 10, 'max_quantity' => null, 'unit_price' => 15000]);

        $line = $this->quote([['product_id' => $shirt->id, 'variant_id' => $variant->id, 'quantity' => 12]])['lines'][0];

        $this->assertEquals(15000, $line['unit_price']['current'], 'It inherits the product price, so the product tiers are its own.');
        $this->assertEquals(180000, $line['total']['current']);
    }

    /* ================= L, M. the order ================= */

    public function test_the_order_records_the_exact_combination_and_its_price(): void
    {
        $iphone = $this->iphone();

        $reference = $this->order([[
            'product_id' => $iphone['product']->id,
            'variant_id' => $iphone['blue256']->id,
            'quantity'   => 2,
        ]])->assertCreated()->json('reference');

        $line = Order::where('reference', $reference)->first();

        $this->assertSame($iphone['blue256']->id, $line->product_variant_id);
        $this->assertSame('2200000.00', $line->price);
        $this->assertSame('4400000.00', $line->total);

        // The words, frozen — so the order still reads correctly after the
        // seller edits or deletes the variant.
        $snapshot = collect($line->variant_options);
        $this->assertEqualsCanonicalizing(
            ['Blue', '256GB'],
            $snapshot->pluck('value')->all(),
        );

        // Only that combination moved.
        $this->assertSame(0, $iphone['blue256']->fresh()->stock);
        $this->assertSame(5, $iphone['black128']->fresh()->stock);
        $this->assertSame(3, $iphone['black256']->fresh()->stock);
        $this->assertSame(7, $iphone['blue128']->fresh()->stock);

        // And the snapshot survives the variant being deleted outright.
        $iphone['blue256']->delete();
        $this->assertEqualsCanonicalizing(
            ['Blue', '256GB'],
            collect($line->fresh()->variant_options)->pluck('value')->all(),
        );
    }

    public function test_cancelling_restores_only_that_combination(): void
    {
        $iphone = $this->iphone();

        $reference = $this->order([[
            'product_id' => $iphone['product']->id,
            'variant_id' => $iphone['black256']->id,
            'quantity'   => 3,
        ]])->assertCreated()->json('reference');

        $this->assertSame(0, $iphone['black256']->fresh()->stock);

        $this->postJson("/api/shop/orders/{$reference}/cancel")->assertOk();

        $this->assertSame(3, $iphone['black256']->fresh()->stock);
        $this->assertSame(5, $iphone['black128']->fresh()->stock);
        $this->assertSame(2, $iphone['blue256']->fresh()->stock);
    }

    /* ================= N. ordinary products ================= */

    public function test_a_simple_product_is_untouched_by_any_of_this(): void
    {
        $bottle = $this->product('Water Bottle', 15000, 50);

        $detail = $this->getJson("/api/shop/products/{$bottle->id}")->assertOk()->json('product');

        $this->assertNull($detail['variant_summary'], 'No summary at all for a product without options.');
        $this->assertSame([], $detail['options']);
        $this->assertSame([], $detail['variants']);
        $this->assertSame([], $detail['price_tiers']);
        $this->assertSame(50, $detail['stock']);
        $this->assertEquals(15000, $detail['price']['current']);

        $card = collect($this->getJson('/api/shop/products?per_page=60')->json('products'))
            ->firstWhere('id', $bottle->id);

        $this->assertFalse($card['price_from'], 'Its price is its price, not a "from".');
        $this->assertSame(50, $card['stock']);

        $line = $this->quote([['product_id' => $bottle->id, 'quantity' => 3]])['lines'][0];
        $this->assertEquals(15000, $line['unit_price']['current']);
        $this->assertEquals(45000, $line['total']['current']);

        $this->order([['product_id' => $bottle->id, 'quantity' => 3]])->assertCreated();
        $this->assertSame(47, $bottle->fresh()->stock);
    }
}
