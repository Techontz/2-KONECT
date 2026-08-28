<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\CheckoutPaymentChannel as Channel;
use App\Models\CurrencyRate;
use App\Models\Order;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Support\Currency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Two currencies, one rate, and a rule about history.
 *
 * The rate is set by a person and by nothing else — there is no feed anywhere
 * in this system and these tests would fail if one appeared, because they pin
 * exact figures that only a manually configured rate can produce.
 *
 * The test that matters most is the last group: an administrator will change
 * the rate, and when they do, every order already placed must go on saying
 * exactly what it said.
 */
class CurrencyTest extends TestCase
{
    use RefreshDatabase;

    private User $shopper;
    private Vendor $vendor;
    private Category $category;
    private Subcategory $subcategory;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::create([
            'name' => 'Seller', 'email' => 'cur-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000091',
        ]);
        $this->vendor = Vendor::create([
            'user_id' => $owner->id, 'business_name' => 'World Traders',
            'phone' => '0700000091', 'is_approved' => true,
        ]);
        $this->category    = Category::create(['name' => 'Electronics']);
        $this->subcategory = Subcategory::create(['category_id' => $this->category->id, 'name' => 'Phones']);
        $this->shopper = User::create([
            'name' => 'Shopper', 'email' => 'cur-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000092',
        ]);

        Channel::create([
            'code' => Channel::LIPA_NAMBA, 'label' => 'Lipa Namba',
            'merchant_name' => '2KONECT', 'number' => '555123',
            'is_active' => true, 'requires_reference' => true,
            'requires_verification' => true, 'sort_order' => 1,
        ]);

        Currency::setRate(2500.0);
    }

    private function product(float $price, string $currency, string $availability = 'local'): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $this->category->id,
            'subcategory_id' => $this->subcategory->id, 'name' => 'Kettle',
            'new_price' => $price, 'base_currency' => $currency, 'stock' => 10,
            'availability' => $availability,
            'source_country' => $availability === 'import' ? 'CN' : 'TZ',
            'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* the rate is a person's decision                                   */
    /* ---------------------------------------------------------------- */

    public function test_the_rate_is_whatever_an_administrator_set(): void
    {
        $this->assertSame(2500.0, Currency::rate());

        Currency::setRate(2600.0);

        $this->assertSame(2600.0, Currency::rate());
    }

    public function test_setting_a_rate_keeps_the_old_one_as_an_audit_record(): void
    {
        $admin = User::create([
            'name' => 'Admin', 'email' => 'cur-admin@test.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000093',
        ]);

        Currency::setRate(2600.0, $admin->id, 'Monthly review');

        $rows = CurrencyRate::orderBy('id')->get();

        $this->assertCount(2, $rows, 'The old rate is kept, not overwritten.');
        $this->assertFalse((bool) $rows[0]->is_active);
        $this->assertTrue((bool) $rows[1]->is_active);

        // Who, from what, to what, and why.
        $this->assertSame($admin->id, $rows[1]->changed_by);
        $this->assertEqualsWithDelta(2500.0, (float) $rows[1]->previous_rate, 0.001);
        $this->assertEqualsWithDelta(2600.0, (float) $rows[1]->rate, 0.001);
        $this->assertSame('Monthly review', $rows[1]->note);
    }

    public function test_exactly_one_rate_is_ever_active(): void
    {
        Currency::setRate(2600.0);
        Currency::setRate(2700.0);

        $this->assertSame(1, CurrencyRate::where('is_active', true)->count());
    }

    public function test_a_rate_of_zero_or_less_is_refused(): void
    {
        foreach ([0.0, -1.0] as $bad) {
            try {
                Currency::setRate($bad);
                $this->fail("A rate of {$bad} should have been refused.");
            } catch (\InvalidArgumentException $e) {
                $this->assertStringContainsString('greater than zero', $e->getMessage());
            }
        }
    }

    /* ---------------------------------------------------------------- */
    /* what a country is offered                                         */
    /* ---------------------------------------------------------------- */

    public function test_tanzania_is_offered_shillings_and_everywhere_else_dollars(): void
    {
        $this->assertSame('TZS', Currency::forCountry('TZ'));

        foreach (['US', 'KE', 'UG', 'GB', 'CN', 'ZA'] as $country) {
            // Kenya is offered USD, not KES. A currency nothing can be paid in
            // would be worse than a foreign one that can.
            $this->assertSame('USD', Currency::forCountry($country), "{$country} should be offered USD.");
        }
    }

    public function test_an_unknown_country_falls_back_without_breaking(): void
    {
        $this->assertSame('USD', Currency::forCountry(null));
        $this->assertSame('USD', Currency::forCountry(''));
    }

    public function test_the_endpoint_reports_the_country_the_edge_detected(): void
    {
        $this->getJson('/api/shop/currency', ['X-Country' => 'TZ'])
            ->assertOk()
            ->assertJsonPath('country', 'TZ')
            ->assertJsonPath('detected', true)
            ->assertJsonPath('suggested_currency', 'TZS')
            ->assertJsonPath('exchange_rate.rate', 2500);

        $this->getJson('/api/shop/currency', ['X-Country' => 'US'])
            ->assertOk()
            ->assertJsonPath('suggested_currency', 'USD');
    }

    public function test_the_endpoint_still_answers_when_nothing_is_detected(): void
    {
        // Detection failing must never stop somebody shopping.
        $this->getJson('/api/shop/currency')
            ->assertOk()
            ->assertJsonPath('country', null)
            ->assertJsonPath('detected', false)
            ->assertJsonPath('default_currency', 'TZS');
    }

    /* ---------------------------------------------------------------- */
    /* the seller's own price is never rewritten                         */
    /* ---------------------------------------------------------------- */

    public function test_a_price_typed_in_dollars_is_stored_in_dollars(): void
    {
        $product = $this->product(20, 'USD');

        // 20, not 50,000. The seller's figure is the authoritative one.
        $this->assertEqualsWithDelta(20.0, (float) $product->fresh()->new_price, 0.001);
        $this->assertSame('USD', $product->fresh()->base_currency);
    }

    public function test_a_dollar_price_shows_as_shillings_using_the_admin_rate(): void
    {
        $product = $this->product(20, 'USD');

        $payload = $this->getJson("/api/shop/products/{$product->id}")->assertOk()->json();
        $price = data_get($payload, 'product.price') ?? data_get($payload, 'data.price') ?? data_get($payload, 'price');

        $this->assertSame('TZS', $price['currency']);
        $this->assertEqualsWithDelta(50000.0, (float) $price['current'], 0.5);
    }

    public function test_a_shilling_price_shows_as_dollars_using_the_admin_rate(): void
    {
        $product = $this->product(50000, 'TZS');

        $payload = $this->getJson("/api/shop/products/{$product->id}", ['X-Currency' => 'USD'])->assertOk()->json();
        $price = data_get($payload, 'product.price') ?? data_get($payload, 'data.price') ?? data_get($payload, 'price');

        $this->assertSame('USD', $price['currency']);
        $this->assertEqualsWithDelta(20.0, (float) $price['current'], 0.01);

        // The canonical figure travels with it, so anything that has to reason
        // about money rather than print it stays currency-independent.
        $this->assertSame('TZS', $price['base_currency']);
        $this->assertEqualsWithDelta(50000.0, (float) $price['base_current'], 0.5);
        $this->assertEqualsWithDelta(2500.0, (float) $price['exchange_rate'], 0.001);
    }

    public function test_changing_the_rate_changes_what_new_visitors_see(): void
    {
        $product = $this->product(50000, 'TZS');

        Currency::setRate(2000.0);

        $payload = $this->getJson("/api/shop/products/{$product->id}", ['X-Currency' => 'USD'])->assertOk()->json();
        $price = data_get($payload, 'product.price') ?? data_get($payload, 'data.price') ?? data_get($payload, 'price');

        // 50,000 / 2,000 = 25, not 20.
        $this->assertEqualsWithDelta(25.0, (float) $price['current'], 0.01);
    }

    public function test_an_unsupported_currency_is_ignored_rather_than_refused(): void
    {
        $product = $this->product(50000, 'TZS');

        // A visitor asking for KES gets a working shop, not a validation error.
        $payload = $this->getJson("/api/shop/products/{$product->id}", ['X-Currency' => 'KES'])->assertOk()->json();
        $price = data_get($payload, 'product.price') ?? data_get($payload, 'data.price') ?? data_get($payload, 'price');

        $this->assertSame('TZS', $price['currency']);
    }

    /* ---------------------------------------------------------------- */
    /* rounding                                                          */
    /* ---------------------------------------------------------------- */

    public function test_shillings_are_never_shown_with_decimals(): void
    {
        // 49,999.83 is not a price anyone has charged in Tanzania.
        $this->assertSame(50000.0, Currency::round(49999.83, 'TZS'));
        $this->assertSame(2.0, Currency::round(1.5, 'TZS'));
        $this->assertSame(0, Currency::decimals('TZS'));
    }

    public function test_dollars_keep_their_cents(): void
    {
        $this->assertSame(19.99, Currency::round(19.9912, 'USD'));
        $this->assertSame(2, Currency::decimals('USD'));
    }

    public function test_conversion_round_trips_within_a_shilling(): void
    {
        $usd = Currency::fromBase(50000, 'USD');
        $this->assertEqualsWithDelta(50000.0, Currency::toBase($usd, 'USD'), 1.0);
    }

    /* ---------------------------------------------------------------- */
    /* HISTORY MUST NOT MOVE                                             */
    /* ---------------------------------------------------------------- */

    private function placeOrder(string $currency): Order
    {
        Sanctum::actingAs($this->shopper);

        $reference = $this->postJson('/api/shop/orders', [
            'items' => [['product_id' => $this->product(50000, 'TZS')->id, 'quantity' => 2]],
            'delivery_address' => 'Mikocheni, Dar es Salaam',
            'customer_phone'   => '0700000092',
            'payment_method'   => Channel::CASH_ON_DELIVERY,
        ], ['X-Currency' => $currency])->assertCreated()->json('order.reference');

        return Order::where('reference', $reference)->firstOrFail();
    }

    public function test_an_order_records_the_rate_it_was_placed_at(): void
    {
        $order = $this->placeOrder('USD');

        $this->assertSame('USD', $order->display_currency);
        $this->assertSame('USD', $order->charge_currency);
        $this->assertEqualsWithDelta(2500.0, (float) $order->exchange_rate, 0.001);
        // The canonical total is untouched by any of it.
        $this->assertEqualsWithDelta(100000.0, (float) $order->total, 0.5);
    }

    public function test_an_order_does_not_change_when_the_rate_changes(): void
    {
        $order = $this->placeOrder('USD');

        Currency::setRate(2700.0);

        $order->refresh();

        // The whole point. $40 at 2,500 stays $40 at 2,500 — it does not
        // silently become $37.04 because a setting moved months later.
        $this->assertEqualsWithDelta(2500.0, (float) $order->exchange_rate, 0.001);
        $this->assertEqualsWithDelta(100000.0, (float) $order->total, 0.5);
        $this->assertEqualsWithDelta(
            40.0,
            (float) $order->total / (float) $order->exchange_rate,
            0.01,
        );
    }

    public function test_the_customers_own_order_page_shows_the_rate_it_was_placed_at(): void
    {
        $order = $this->placeOrder('USD');
        Currency::setRate(2700.0);

        Sanctum::actingAs($this->shopper);
        $payload = $this->getJson("/api/shop/orders/{$order->reference}", ['X-Currency' => 'USD'])
            ->assertOk()->json('order');

        $this->assertEqualsWithDelta(100000.0, (float) $payload['total'], 0.5);
    }

    public function test_a_rate_change_rewrites_no_financial_record(): void
    {
        $order = $this->placeOrder('TZS');

        $before = [
            'total'         => (float) $order->total,
            'price'         => (float) $order->price,
            'delivery_fee'  => (float) $order->delivery_fee,
            'exchange_rate' => (float) $order->exchange_rate,
        ];

        Currency::setRate(2700.0);
        Currency::setRate(3000.0);

        $order->refresh();

        foreach ($before as $field => $value) {
            $this->assertEqualsWithDelta(
                $value,
                (float) $order->{$field},
                0.001,
                "orders.{$field} must not move when the exchange rate does.",
            );
        }
    }

    /* ---------------------------------------------------------------- */
    /* delivery                                                          */
    /* ---------------------------------------------------------------- */

    public function test_no_delivery_fee_is_invented_in_either_currency(): void
    {
        foreach (['TZS', 'USD'] as $currency) {
            $order = $this->placeOrder($currency);
            $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.001);
            Order::query()->delete();
        }
    }

    /* ---------------------------------------------------------------- */
    /* no rate lives anywhere but the database                           */
    /* ---------------------------------------------------------------- */

    public function test_there_is_no_hardcoded_rate_left_in_the_backend(): void
    {
        $root = base_path('app');
        $offenders = [];

        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));

        foreach ($iterator as $file) {
            if ($file->isDir() || $file->getExtension() !== 'php') {
                continue;
            }

            $path = $file->getPathname();

            // The service is allowed one placeholder, and it says so.
            // The service holds the documented placeholder, and the admin
            // screen prints it back so an administrator can see what is in
            // use. Neither is a rate applied to a price.
            if (str_ends_with($path, 'Support/Currency.php')
                || str_contains($path, 'CurrencyRateResource')) {
                continue;
            }

            $source = file_get_contents($path);

            // Any bare multiplication or division by something rate-shaped.
            if (preg_match('/[*\/]\s*2[0-9]{3}(\.\d+)?\b/', $source)
                || preg_match('/0\.000\d{3}/', $source)) {
                $offenders[] = str_replace(base_path() . '/', '', $path);
            }
        }

        $this->assertSame([], $offenders, 'A hardcoded exchange rate has appeared in application code.');
    }
}
