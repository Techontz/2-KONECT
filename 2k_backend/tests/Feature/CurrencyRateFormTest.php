<?php

namespace Tests\Feature;

use App\Filament\Resources\CurrencyRateResource\Pages\CreateCurrencyRate;
use App\Models\CurrencyRate;
use App\Models\User;
use App\Support\Currency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What the admin rate form actually stores.
 *
 * Production ended up with this row:
 *
 *     rate = 1.000000   note = "2800"   is_active = 1
 *
 * written by a form somebody had typed 2800 into. The save path was
 * `(float) $data['rate']`, and a cast is not a check — PHP turns `true` into
 * 1.0 and a non-empty array into 1.0 without a murmur. Whatever arrived, the
 * cast accepted it, and a rate of 1 does not look like a failure. It looks
 * like a marketplace where a 2.7 million shilling phone costs 2.7 million
 * dollars.
 *
 * These cover the hostile inputs first, because the ordinary ones already
 * worked and told us nothing.
 */
class CurrencyRateFormTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::create([
            'name' => 'Admin', 'email' => 'rate-admin@test.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000099',
        ]));
    }

    /* ---------------------------------------------------------------- */
    /* the values that silently became 1                                 */
    /* ---------------------------------------------------------------- */

    #[\PHPUnit\Framework\Attributes\DataProvider('castsToOne')]
    public function test_a_value_that_would_cast_to_one_is_refused_not_stored($submitted, string $what): void
    {
        // Proof the old code would have stored 1 for each of these.
        $this->assertSame(1.0, (float) $submitted, "{$what} casts to 1.0 — that is the trap.");

        try {
            Currency::parseRate($submitted);
            $this->fail("{$what} should have been refused, not turned into a rate.");
        } catch (\InvalidArgumentException $e) {
            $this->assertNotEmpty($e->getMessage());
        }
    }

    public static function castsToOne(): array
    {
        return [
            'boolean true'    => [true, 'true'],
            'non-empty array' => [['2800'], 'an array'],
        ];
    }

    /**
     * `"2,800"` casts to 2.0 and `"2 800"` casts to 2.0. Both are worse than
     * an error, because both look like a rate somebody might have meant.
     */
    public function test_a_thousands_separator_is_refused_rather_than_truncated(): void
    {
        foreach (['2,800', '2 800', '2.800,00', '2800abc', 'abc'] as $bad) {
            try {
                Currency::parseRate($bad);
                $this->fail("\"{$bad}\" should have been refused.");
            } catch (\InvalidArgumentException $e) {
                $this->assertStringContainsString('rate', strtolower($e->getMessage()));
            }
        }
    }

    public function test_null_and_missing_are_refused(): void
    {
        foreach ([null, ''] as $empty) {
            $this->expectException(\InvalidArgumentException::class);
            Currency::parseRate($empty);
        }
    }

    /* ---------------------------------------------------------------- */
    /* the values that must work                                         */
    /* ---------------------------------------------------------------- */

    #[\PHPUnit\Framework\Attributes\DataProvider('goodRates')]
    public function test_a_real_rate_parses_to_itself($submitted, float $expected): void
    {
        $this->assertEqualsWithDelta($expected, Currency::parseRate($submitted), 0.0001);
    }

    public static function goodRates(): array
    {
        return [
            'string 2800'  => ['2800', 2800.0],
            'int 2800'     => [2800, 2800.0],
            'float 2800'   => [2800.0, 2800.0],
            'string 2500'  => ['2500', 2500.0],
            'decimal'      => ['2500.50', 2500.50],
            'padded'       => ['  2700  ', 2700.0],
            'one'          => ['1', 1.0],
            'hundred'      => ['100', 100.0],
        ];
    }

    /* ---------------------------------------------------------------- */
    /* the real Filament page, end to end                                */
    /* ---------------------------------------------------------------- */

    /** A. Creating a rate of 2800 stores 2800 — and the note stays the note. */
    public function test_entering_2800_stores_2800_and_not_1(): void
    {
        \Livewire\Livewire::test(CreateCurrencyRate::class)
            ->fillForm(['rate' => '2800', 'note' => '2800'])
            ->call('create')
            ->assertHasNoFormErrors();

        $row = CurrencyRate::latest('id')->first();

        $this->assertNotNull($row);
        $this->assertEqualsWithDelta(2800.0, (float) $row->rate, 0.001, 'The rate stored is not the rate entered.');
        $this->assertSame('2800', $row->note, 'The reason must never be mistaken for the rate.');
        $this->assertTrue((bool) $row->is_active);
    }

    /** B & C. The active rate, and what the API would serve. */
    public function test_the_active_rate_and_the_endpoint_both_report_2800(): void
    {
        \Livewire\Livewire::test(CreateCurrencyRate::class)
            ->fillForm(['rate' => '2800', 'note' => 'monthly review'])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertEqualsWithDelta(2800.0, Currency::rate(), 0.001);

        $this->getJson('/api/shop/currency')
            ->assertOk()
            ->assertJsonPath('exchange_rate.rate', 2800);
    }

    /** F. Changing the rate changes what the catalogue converts to. */
    public function test_moving_the_rate_moves_new_conversions(): void
    {
        Currency::setRate(2500.0);
        $this->assertEqualsWithDelta(2.80, Currency::fromBase(7000, 'USD'), 0.001);

        \Livewire\Livewire::test(CreateCurrencyRate::class)
            ->fillForm(['rate' => '2800', 'note' => 'moved'])
            ->call('create')
            ->assertHasNoFormErrors();

        // D. 7000 / 2800 = 2.50
        $this->assertEqualsWithDelta(2.50, Currency::fromBase(7000, 'USD'), 0.001);
        // E. 2,500,000 / 2800 = 892.857… -> 892.86
        $this->assertEqualsWithDelta(892.86, Currency::fromBase(2500000, 'USD'), 0.01);
        // and the figure from the brief
        $this->assertEqualsWithDelta(964.29, Currency::fromBase(2700000, 'USD'), 0.01);
    }

    /** H, I, J. The form accepts every rate a person would type. */
    public function test_the_form_accepts_one_and_2500_and_2800(): void
    {
        foreach (['1', '2500', '2800', '2500.50'] as $rate) {
            \Livewire\Livewire::test(CreateCurrencyRate::class)
                ->fillForm(['rate' => $rate, 'note' => "set {$rate}"])
                ->call('create')
                ->assertHasNoFormErrors();

            $this->assertEqualsWithDelta(
                (float) $rate,
                (float) CurrencyRate::latest('id')->first()->rate,
                0.001,
                "Entering {$rate} did not store {$rate}.",
            );
        }
    }

    /** K. Below 1 is refused as an inverted entry. */
    public function test_the_form_rejects_an_inverted_rate(): void
    {
        \Livewire\Livewire::test(CreateCurrencyRate::class)
            ->fillForm(['rate' => '0.0004', 'note' => 'oops'])
            ->call('create')
            ->assertHasFormErrors(['rate']);

        $this->assertSame(0, CurrencyRate::count(), 'Nothing should have been written.');
    }

    public function test_the_form_rejects_zero_and_negatives(): void
    {
        foreach (['0', '-1', '-2800'] as $bad) {
            \Livewire\Livewire::test(CreateCurrencyRate::class)
                ->fillForm(['rate' => $bad, 'note' => 'bad'])
                ->call('create')
                ->assertHasFormErrors(['rate']);
        }

        $this->assertSame(0, CurrencyRate::count());
    }

    /**
     * G. History is untouched by any of this.
     *
     * Asserted at the level this test can reach without inventing an order:
     * a rate change writes a new row and leaves every earlier one alone, which
     * is the property historical snapshots depend on. The end-to-end case —
     * an actual order surviving a rate change through the API — lives in
     * CurrencyTest, which has the fixtures for it.
     */
    public function test_a_rate_change_adds_a_row_and_rewrites_none(): void
    {
        Currency::setRate(2500.0);
        $first = CurrencyRate::latest('id')->first();

        \Livewire\Livewire::test(CreateCurrencyRate::class)
            ->fillForm(['rate' => '2800', 'note' => 'moved'])
            ->call('create')
            ->assertHasNoFormErrors();

        $first->refresh();

        // The old row keeps its rate and its note; only its active flag moves.
        $this->assertEqualsWithDelta(2500.0, (float) $first->rate, 0.001);
        $this->assertFalse((bool) $first->is_active);
        $this->assertSame(2, CurrencyRate::count());

        // And the new row records what it replaced.
        $latest = CurrencyRate::latest('id')->first();
        $this->assertEqualsWithDelta(2800.0, (float) $latest->rate, 0.001);
        $this->assertEqualsWithDelta(2500.0, (float) $latest->previous_rate, 0.001);
    }
}
