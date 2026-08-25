<?php

namespace Tests\Unit;

use App\Support\Money;
use PHPUnit\Framework\TestCase;

/**
 * The one conversion in the system, and the one place it may live.
 *
 * A gateway takes an integer in the currency's minor unit. Getting that wrong
 * is not a rounding error — it charges somebody a hundred times too much or
 * too little, silently, and the first anybody hears of it is a statement.
 *
 * The zero-decimal list is copied verbatim from Stripe's own published dataset
 * behind docs.stripe.com/currencies. TZS is deliberately absent from it: a
 * Tanzanian Shilling is quoted in whole units and it would be entirely
 * reasonable to assume Stripe treats it as zero-decimal. It does not.
 */
class MoneyMinorUnitsTest extends TestCase
{
    public function test_tzs_is_two_decimal_to_a_gateway_despite_being_quoted_whole(): void
    {
        $this->assertFalse(Money::isZeroDecimal('TZS'));
        $this->assertSame(5000000, Money::toMinorUnits(50000.0, 'TZS'));
        $this->assertSame(10300000, Money::toMinorUnits(103000.0, 'TZS'));
    }

    public function test_the_base_currency_is_used_when_none_is_named(): void
    {
        $this->assertSame(5000000, Money::toMinorUnits(50000.0));
    }

    public function test_a_zero_decimal_currency_is_not_multiplied(): void
    {
        $this->assertTrue(Money::isZeroDecimal('JPY'));
        $this->assertSame(500, Money::toMinorUnits(500.0, 'JPY'));

        // The neighbouring shilling, and the trap: UGX *is* zero-decimal to
        // Stripe while TZS is not.
        $this->assertTrue(Money::isZeroDecimal('UGX'));
        $this->assertFalse(Money::isZeroDecimal('TZS'));
    }

    public function test_the_zero_decimal_list_matches_stripes_published_set(): void
    {
        $stripe = ['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'];

        foreach ($stripe as $code) {
            $this->assertTrue(Money::isZeroDecimal($code), "$code should be zero-decimal");
        }

        foreach (['TZS', 'USD', 'EUR', 'GBP', 'KES', 'ZAR', 'NGN'] as $code) {
            $this->assertFalse(Money::isZeroDecimal($code), "$code should not be zero-decimal");
        }
    }

    public function test_case_does_not_matter(): void
    {
        $this->assertSame(5000000, Money::toMinorUnits(50000.0, 'tzs'));
        $this->assertTrue(Money::isZeroDecimal('jpy'));
    }

    public function test_conversion_round_trips(): void
    {
        $this->assertEqualsWithDelta(103000.0, Money::fromMinorUnits(10300000, 'TZS'), 0.001);
        $this->assertEqualsWithDelta(500.0, Money::fromMinorUnits(500, 'JPY'), 0.001);
    }

    public function test_fractional_two_decimal_amounts_round_to_the_minor_unit(): void
    {
        $this->assertSame(1999, Money::toMinorUnits(19.99, 'USD'));
        $this->assertSame(150, Money::toMinorUnits(1.5, 'USD'));
    }

    public function test_a_value_a_float_cannot_hold_exactly_is_not_short_changed(): void
    {
        // 9.995 is stored as 9.99499999..., so scaling before rounding gives
        // 999 and charges a cent less than the price on the page. The helper
        // rounds to the currency's precision first, so it does not.
        $this->assertSame(1000, Money::toMinorUnits(9.995, 'USD'));
        $this->assertSame(70, Money::toMinorUnits(0.70, 'USD'));
        $this->assertSame(115, Money::toMinorUnits(1.15, 'USD'));
    }

    public function test_a_negative_amount_is_refused(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Money::toMinorUnits(-1.0, 'TZS');
    }

    public function test_a_currency_that_must_end_in_double_zero_refuses_a_fraction(): void
    {
        // Stripe documents ISK, UGX, HUF and TWD as needing amounts evenly
        // divisible by 100. Refused here, with the currency named, rather than
        // as a 400 from an API call three layers away.
        $this->expectException(\InvalidArgumentException::class);

        Money::toMinorUnits(5.5, 'ISK');
    }

    public function test_zero_is_a_valid_amount(): void
    {
        $this->assertSame(0, Money::toMinorUnits(0.0, 'TZS'));
    }
}
