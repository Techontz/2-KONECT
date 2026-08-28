<?php

namespace App\Support;

use App\Models\CurrencyRate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

    /**
     * Below this, a rate is the reciprocal typed in by mistake.
     *
     * One shilling per dollar is already absurd, so anything under it is not a
     * business decision — it is 0.0004 entered where 2500 was meant. The floor
     * sits at 1 rather than somewhere more opinionated because the job here is
     * to catch an inverted entry, not to have views on what 2KONECT should
     * charge.
     *
     * The failure this prevents is silent, which is why it is worth
     * preventing: nothing errors at 0.0004. The catalogue simply starts
     * quoting a 2.7 million shilling phone at six billion dollars.
     */
    public const MINIMUM_PLAUSIBLE_RATE = 1.0;

    /**
     * The admin rate field's HTML step and minimum.
     *
     * Declared here rather than inline in the form because a number input's
     * valid values are min + n*step, and getting that pair wrong is not a
     * cosmetic bug: min=0.000001 with step=1 admitted only 0.000001, 1.000001,
     * 2.000001 … so 2500 was refused by the browser, somebody accepted the
     * 1.000001 it offered instead, and the whole catalogue was repriced by a
     * factor of 2,500.
     *
     * 0.01 admits every rate anybody would type. Whether a value makes sense
     * is decided by MINIMUM_PLAUSIBLE_RATE, which can explain itself; a
     * browser step error cannot.
     */
    public const RATE_INPUT_STEP = 0.01;
    public const RATE_INPUT_MIN  = 0.01;

    /**
     * Turn whatever the form submitted into a rate, or refuse it.
     *
     * This exists because `(float) $submitted` did not. A cast is not a check:
     * PHP turns `true` into 1.0, a non-empty array into 1.0, and "abc" into
     * 0.0, all without a murmur. So a form that sent anything other than the
     * number the administrator typed produced a rate of 1 — and a rate of 1
     * does not look like a failure. It looks like a marketplace where a
     * 2.7 million shilling phone costs 2.7 million dollars.
     *
     * That is what happened. `currency_rates` holds a row with rate 1.000000
     * and the note "2800", written by a form the administrator had typed 2800
     * into. Whatever reached the cast was not "2800", and the cast agreed to
     * it anyway.
     *
     * So: a string of digits, or a real int/float. Nothing else. Commas and
     * spaces are refused rather than silently truncated — "2,800" casts to 2.0
     * in PHP, which is its own quiet disaster.
     *
     * @param  mixed  $submitted
     * @throws \InvalidArgumentException
     */
    public static function parseRate($submitted): float
    {
        if (is_bool($submitted) || is_array($submitted) || is_object($submitted) || $submitted === null) {
            throw new \InvalidArgumentException(sprintf(
                'The exchange rate was submitted as %s rather than a number. Nothing has been saved.',
                get_debug_type($submitted),
            ));
        }

        if (is_string($submitted)) {
            $trimmed = trim($submitted);

            // A cast would read "2,800" as 2 and "2 800" as 2. Both are worse
            // than an error, because both look like a rate.
            if (! preg_match('/^\d+(\.\d+)?$/', $trimmed)) {
                throw new \InvalidArgumentException(sprintf(
                    'Could not read "%s" as an exchange rate. Enter digits only, for example 2500 or 2500.50.',
                    $submitted,
                ));
            }

            $submitted = $trimmed;
        }

        if (! is_numeric($submitted)) {
            throw new \InvalidArgumentException('The exchange rate must be a number.');
        }

        $rate = (float) $submitted;

        if (! is_finite($rate)) {
            throw new \InvalidArgumentException('The exchange rate must be a finite number.');
        }

        return $rate;
    }

    /** Whether a browser would accept this value in the admin rate field. */
    public static function isEnterableRate(float $rate): bool
    {
        $steps = ($rate - self::RATE_INPUT_MIN) / self::RATE_INPUT_STEP;

        return $rate >= self::RATE_INPUT_MIN && abs($steps - round($steps)) < 1e-6;
    }

    /* ---------------------------------------------------------------- */
    /* the rate                                                          */
    /* ---------------------------------------------------------------- */

    /**
     * How many TZS one USD buys, as the administrator set it.
     *
     * Falls back rather than throwing when the table cannot be read. That is
     * not defensiveness for its own sake: this is called by every price on
     * every page, so an exception here is not a broken rate — it is a
     * storefront that will not load at all. The window it covers is real and
     * ordinary: code deployed a minute before `migrate` runs, a replica that
     * has not caught up, a database blip. A shop that quotes a placeholder for
     * thirty seconds is better than one that shows nothing.
     */
    public static function rate(): float
    {
        return (float) Cache::rememberForever(self::CACHE_KEY, function () {
            return self::activeRow()?->rate !== null
                ? (float) self::activeRow()->rate
                : self::FALLBACK_RATE;
        });
    }

    /** Whether the rate in use is a real one or the placeholder. */
    public static function isConfigured(): bool
    {
        return self::activeRow() !== null;
    }

    public static function current(): ?CurrencyRate
    {
        return self::activeRow();
    }

    /**
     * The active row, or null for any reason at all.
     *
     * "No rate has been set" and "the table is not there yet" are different
     * problems with the same correct answer at this layer: use the documented
     * placeholder and let the admin screen say so.
     */
    private static function activeRow(): ?CurrencyRate
    {
        try {
            return CurrencyRate::active()
                ->where('base', self::QUOTE)
                ->where('quote', self::BASE)
                ->latest('id')
                ->first();
        } catch (\Throwable $e) {
            Log::warning('Currency rate unavailable; using the placeholder.', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
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

        // ---- the inverted-rate guard ----
        //
        // The rate is "how many shillings one dollar buys", so it is a number
        // in the thousands. A value near 1 is almost always the reciprocal
        // typed in by mistake — and the mistake is close to invisible, because
        // nothing errors: the catalogue simply starts quoting a 2.7 million
        // shilling phone at 2.7 million dollars.
        //
        // That happened. Production ran at 1.000001 for a while and every USD
        // price on the site was wrong by a factor of 2,500.
        //
        // The floor is deliberately generous. It is not a claim about the real
        // exchange rate — 2KONECT sets its own — only that no plausible
        // business rate puts a dollar below a hundred shillings.
        if ($rate < self::MINIMUM_PLAUSIBLE_RATE) {
            throw new \InvalidArgumentException(sprintf(
                'A rate of %s looks inverted. Enter how many Tanzanian Shillings one US dollar is worth '
                . '— for example 2500. You may have meant %s.',
                rtrim(rtrim(number_format($rate, 6), '0'), '.'),
                rtrim(rtrim(number_format(1 / $rate, 6), '0'), '.'),
            ));
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
