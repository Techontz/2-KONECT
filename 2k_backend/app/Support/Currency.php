<?php

namespace App\Support;

use App\Models\CurrencyRate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The only place money changes currency.
 *
 * ---- the rate is set by a person ----
 *
 * There is no feed, no API and no market data anywhere in this class, and that
 * is the point rather than a limitation. A marketplace that repriced its whole
 * catalogue every time a wire service twitched would show a customer one figure
 * on the product page and a different one in the basket, and would owe its
 * sellers a different amount each time anyone refreshed. The rate moves when an
 * administrator moves it, it is written down with their name against it, and
 * between those moments it does not move at all.
 *
 * ---- TZS is the canonical currency ----
 *
 * Every price column in this database is Tanzanian Shillings and stays that
 * way. A seller quoting in dollars has their figure converted once, on the way
 * in, and the shilling amount is what the order is priced from. Display
 * conversion happens on the way out. Nothing round-trips, because a value
 * converted out and back does not come home.
 *
 * ---- the rate direction ----
 *
 * Stored and entered as a person says it: 1 USD = 2,500 TZS. The reciprocal is
 * never stored, only derived, because two stored numbers that must agree
 * eventually will not.
 */
class Currency
{
    public const BASE  = 'TZS';
    public const QUOTE = 'USD';

    /** Everything the marketplace supports. Two, deliberately. */
    public const SUPPORTED = [self::BASE, self::QUOTE];

    private const CACHE_KEY = 'currency.rate.usd_tzs';

    /**
     * The fallback when no administrator has ever set a rate.
     *
     * Not a real rate and not meant to be one — it exists so a fresh database
     * renders prices instead of dividing by nothing. The admin panel says
     * plainly when this is what is in use.
     */
    public const FALLBACK_RATE = 2500.0;

    /* ---------------------------------------------------------------- */
    /* the rate                                                          */
    /* ---------------------------------------------------------------- */

    /** How many TZS one USD buys, as the administrator set it. */
    public static function rate(): float
    {
        return (float) Cache::rememberForever(self::CACHE_KEY, function () {
            $active = CurrencyRate::active()
                ->where('base', self::QUOTE)
                ->where('quote', self::BASE)
                ->latest('id')
                ->first();

            return $active ? (float) $active->rate : self::FALLBACK_RATE;
        });
    }

    /** Whether the rate in use is a real one or the placeholder. */
    public static function isConfigured(): bool
    {
        return CurrencyRate::active()
            ->where('base', self::QUOTE)
            ->where('quote', self::BASE)
            ->exists();
    }

    public static function current(): ?CurrencyRate
    {
        return CurrencyRate::active()
            ->where('base', self::QUOTE)
            ->where('quote', self::BASE)
            ->latest('id')
            ->first();
    }

    /**
     * Set a new rate, keeping the old one as history.
     *
     * The previous row is deactivated rather than deleted and the new row
     * records what it replaced, so the audit trail is the table itself. Both
     * happen in one transaction: a moment with two active rates, or none, is a
     * moment where prices are undefined.
     *
     * The catalogue cache is retired afterwards. Without that, a rate changed
     * at noon would keep showing yesterday's converted prices until every
     * cached page happened to expire.
     */
    public static function setRate(float $rate, ?int $userId = null, ?string $note = null): CurrencyRate
    {
        if ($rate <= 0) {
            throw new \InvalidArgumentException('An exchange rate must be greater than zero.');
        }

        $created = DB::transaction(function () use ($rate, $userId, $note) {
            $previous = self::current();

            CurrencyRate::where('base', self::QUOTE)
                ->where('quote', self::BASE)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            return CurrencyRate::create([
                'base'          => self::QUOTE,
                'quote'         => self::BASE,
                'rate'          => $rate,
                'is_active'     => true,
                'changed_by'    => $userId,
                'previous_rate' => $previous?->rate,
                'note'          => $note,
            ]);
        });

        self::forget();

        return $created;
    }

    /** Drop the memoised rate and every catalogue page priced with it. */
    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
        CatalogCache::flush();
    }

    /* ---------------------------------------------------------------- */
    /* conversion                                                        */
    /* ---------------------------------------------------------------- */

    public static function supports(?string $code): bool
    {
        return in_array(strtoupper((string) $code), self::SUPPORTED, true);
    }

    /** Whatever was asked for, or the canonical currency. Never throws. */
    public static function normalise(?string $code): string
    {
        $code = strtoupper(trim((string) $code));

        return self::supports($code) ? $code : self::BASE;
    }

    /**
     * A seller's own figure, as shillings.
     *
     * Used once, when a price is saved. The result is what every later
     * calculation works from, so a product quoted at $20 is stored as 50,000
     * and behaves identically to one typed as 50,000.
     */
    public static function toBase(float $amount, ?string $from): float
    {
        return self::normalise($from) === self::QUOTE
            ? self::round($amount * self::rate(), self::BASE)
            : self::round($amount, self::BASE);
    }

    /** Shillings, as the currency the customer is reading. */
    public static function fromBase(float $baseAmount, ?string $to, ?float $rate = null): float
    {
        $to = self::normalise($to);

        if ($to === self::BASE) {
            return self::round($baseAmount, self::BASE);
        }

        $rate = $rate ?: self::rate();

        return self::round($baseAmount / $rate, $to);
    }

    /**
     * Rounding, per currency.
     *
     * Shillings are quoted whole. A price of "TZS 49,999.83" is not a price
     * anyone has ever charged in Tanzania — it is an artefact of dividing, and
     * showing it makes a marketplace look like a spreadsheet. Dollars keep
     * their cents, because there they mean something.
     */
    public static function round(float $amount, ?string $currency): float
    {
        return self::normalise($currency) === self::BASE
            ? (float) round($amount)
            : (float) round($amount, 2);
    }

    public static function decimals(?string $currency): int
    {
        return self::normalise($currency) === self::BASE ? 0 : 2;
    }

    public static function symbol(?string $currency): string
    {
        return self::normalise($currency) === self::QUOTE ? '$' : 'TZS';
    }

    /* ---------------------------------------------------------------- */
    /* what a country should see first                                   */
    /* ---------------------------------------------------------------- */

    /**
     * The currency to *offer* a visitor from this country.
     *
     * A suggestion and nothing more. It decides what somebody sees before they
     * have expressed a preference, and is overruled the moment they do — a
     * Tanzanian who picks dollars keeps dollars, on that visit and every one
     * after.
     *
     * Only two currencies exist here on purpose. A visitor from Nairobi is
     * offered USD, not KES: 2KONECT does not price in shillings-of-Kenya, and
     * offering a currency nothing can be paid in would be worse than offering
     * a foreign one that can.
     */
    public static function forCountry(?string $countryCode): string
    {
        return strtoupper(trim((string) $countryCode)) === Sourcing::HOME_COUNTRY
            ? self::BASE
            : self::QUOTE;
    }
}
