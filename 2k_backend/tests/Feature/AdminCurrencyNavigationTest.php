<?php

namespace Tests\Feature;

use App\Filament\Resources\CurrencyRateResource;
use App\Models\CurrencyRate;
use App\Support\Currency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Settings → Currency exists, sits last, and cannot be rewritten.
 *
 * The page was reported missing from the live admin panel. It was not missing
 * from the code — it had simply never been deployed, because the release that
 * went out predates it. These pin the things that would make it genuinely
 * missing, or wrong, once it is there.
 */
class AdminCurrencyNavigationTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_currency_page_lives_under_settings(): void
    {
        $this->assertSame('Settings', CurrencyRateResource::getNavigationGroup());
        $this->assertSame('Currency', CurrencyRateResource::getNavigationLabel());
    }

    public function test_it_sorts_after_the_other_settings_pages(): void
    {
        // Customer Payment (1), Payment Types (1), Payment Methods (2), then
        // Currency. A tie leaves the order to registration order, which is not
        // an order anybody chose.
        $this->assertGreaterThan(
            2,
            CurrencyRateResource::getNavigationSort(),
            'Currency must sort after the payment pages, not tie with one.',
        );
    }

    public function test_the_rate_page_is_reachable(): void
    {
        $this->assertNotEmpty(CurrencyRateResource::getUrl('index'));
        $this->assertNotEmpty(CurrencyRateResource::getUrl('create'));
    }

    /**
     * History is the point of the table, so it cannot be edited or deleted.
     *
     * Correcting a rate in place would erase the record of what prices were
     * actually shown while it was wrong. A mistake is fixed by setting the
     * right rate, which leaves both the mistake and the correction on record.
     */
    public function test_a_recorded_rate_can_never_be_edited_or_deleted(): void
    {
        $rate = Currency::setRate(2500.0);

        $this->assertFalse(CurrencyRateResource::canEdit($rate));
        $this->assertFalse(CurrencyRateResource::canDelete($rate));
    }

    public function test_the_audit_records_who_changed_what_and_why(): void
    {
        Currency::setRate(2500.0);

        $admin = \App\Models\User::create([
            'name' => 'Admin', 'email' => 'nav-admin@test.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000094',
        ]);

        Currency::setRate(2600.0, $admin->id, 'Updated based on current business pricing.');

        $latest = CurrencyRate::latest('id')->first();

        $this->assertEqualsWithDelta(2600.0, (float) $latest->rate, 0.001);
        $this->assertEqualsWithDelta(2500.0, (float) $latest->previous_rate, 0.001);
        $this->assertSame($admin->id, $latest->changed_by);
        $this->assertSame('Updated based on current business pricing.', $latest->note);
        $this->assertNotNull($latest->created_at);
        $this->assertSame(2, CurrencyRate::count(), 'The old rate is kept, not replaced.');
    }

    /** The admin types 2500, not 0.0004. */
    public function test_the_rate_is_entered_the_way_a_person_says_it(): void
    {
        Currency::setRate(2500.0);

        $this->assertEqualsWithDelta(2500.0, Currency::rate(), 0.001);
        $this->assertSame('USD', CurrencyRate::latest('id')->first()->base);
        $this->assertSame('TZS', CurrencyRate::latest('id')->first()->quote);
    }

    /* ---------------------------------------------------------------- */
    /* the form must accept a rate somebody would actually type          */
    /* ---------------------------------------------------------------- */

    /**
     * The bug that repriced the catalogue.
     *
     * A number input's valid values are min + n*step. The field was
     * min=0.000001, step=1, so the only acceptable inputs were 0.000001,
     * 1.000001, 2.000001 … 2500 was refused by the browser, which offered
     * "the two nearest valid values are 0.000001 and 1.000001". Somebody
     * picked 1.000001, and every USD price on the site was wrong by a factor
     * of 2,500 until it was noticed.
     */
    public function test_the_rate_field_admits_every_rate_a_person_would_type(): void
    {
        foreach ([1.0, 100.0, 2500.0, 2500.50, 2700.0, 5000.0] as $rate) {
            $this->assertTrue(
                Currency::isEnterableRate($rate),
                "A browser would refuse {$rate} in the admin rate field.",
            );
        }
    }

    public function test_the_broken_step_that_caused_the_incident_cannot_return(): void
    {
        // The exact pair that shipped: min 0.000001, step 1. A browser compares
        // exactly, so 2499.999999 steps is not a whole number of steps and
        // 2500 is refused. Asserted as an exact inequality rather than with a
        // tolerance, because the gap being measured IS one part in a million.
        $brokenSteps = (2500 - 0.000001) / 1;
        $this->assertNotSame(
            (float) round($brokenSteps),
            $brokenSteps,
            'min=0.000001 with step=1 refuses 2500 — the configuration that broke production.',
        );

        // And the one that shipped instead does not.
        $this->assertSame(0.01, Currency::RATE_INPUT_STEP);
        $this->assertSame(0.01, Currency::RATE_INPUT_MIN);
        $this->assertSame(1.0, Currency::MINIMUM_PLAUSIBLE_RATE);
    }

    public function test_a_browser_still_blocks_zero_and_negatives(): void
    {
        foreach ([0.0, -1.0, -2500.0] as $bad) {
            $this->assertFalse(Currency::isEnterableRate($bad));
        }
    }
}
