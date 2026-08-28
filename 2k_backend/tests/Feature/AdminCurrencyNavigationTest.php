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
}
