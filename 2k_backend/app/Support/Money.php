<?php

namespace App\Support;

/**
 * Centralised money handling.
 *
 * The database stores every price in the canonical currency — Tanzanian
 * Shillings — exactly as the existing catalogue always has. Nothing about
 * that changes. This class only decides how a stored amount is *presented*,
 * so conversion logic lives in one place instead of being scattered through
 * controllers and React components.
 */
class Money
{
    /** The currency every `products.new_price` / `old_price` is stored in. */
    public const BASE = 'TZS';

    /**
     * Currencies a payment gateway expects without a minor unit.
     *
     * Copied verbatim from Stripe's own published dataset — the
     * `SupportedPresentmentCurrencies.zero_decimal` list behind
     * <https://docs.stripe.com/currencies>. Sixteen entries, checked rather
     * than remembered, because the cost of being wrong here is not a rounding
     * error: it is charging a customer one hundred times too much, or too
     * little, and only finding out from a statement.
     *
     * TZS is deliberately absent. Tanzanian Shillings are quoted and paid in
     * whole units, and it would be reasonable to assume Stripe treats them as
     * zero-decimal — it does not. TZS is a two-decimal currency to Stripe, so
     * TZS 50,000 is `5000000`.
     */
    private const ZERO_DECIMAL = [
        'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
        'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
    ];

    /**
     * Currencies whose minor unit exists but must always read `00`.
     *
     * Stripe documents these as special cases: they transitioned to
     * zero-decimal but are still submitted as two-decimal values, and a
     * fractional amount is refused. Kept separate from the list above because
     * the multiplication is the same but the validation is not.
     */
    private const HUNDREDS_ONLY = ['ISK', 'UGX', 'HUF', 'TWD'];

    public static function isZeroDecimal(string $currency): bool
    {
        return in_array(strtoupper($currency), self::ZERO_DECIMAL, true);
    }

    /**
     * A stored amount as the integer minor unit a gateway expects.
     *
     * The **only** place this multiplication happens. Every other file asks
     * this class rather than writing `* 100`, because a second copy is a
     * second chance to get a currency's decimal behaviour wrong, and the two
     * copies will not disagree loudly — they will disagree by a factor of a
     * hundred, silently, on somebody's card.
     *
     * Rounds half-up on the minor unit. A TZS price is a whole number to begin
     * with, so this only ever matters for a currency that genuinely has cents.
     */
    public static function toMinorUnits(float $amount, string $currency = self::BASE): int
    {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Cannot convert a negative amount.');
        }

        $currency = strtoupper($currency);

        // Rounded to the currency's own precision *before* being scaled.
        //
        // Multiplying first goes wrong on values a binary float cannot hold
        // exactly: 9.995 is stored as 9.99499999…, so `round(9.995 * 100)` is
        // 999 and the customer is charged a cent less than the price they were
        // shown. Rounding to two places first resolves the representation, and
        // only then does the scale happen.
        //
        // For this catalogue it is belt and braces — `orders.total` is a
        // decimal(12,2) holding whole shillings — but the helper is the one
        // place any currency passes through, and it should be right for the
        // ones that genuinely have cents.
        $minor = self::isZeroDecimal($currency)
            ? (int) round($amount)
            : (int) round(round($amount, 2) * 100);

        // ISK, UGX, HUF and TWD carry a minor unit that must always be zero.
        // Submitting a fractional amount is refused by the gateway, so it is
        // refused here instead — with a message that says which currency and
        // why, rather than a 400 from an API call three layers away.
        if (in_array($currency, self::HUNDREDS_ONLY, true) && $minor % 100 !== 0) {
            throw new \InvalidArgumentException(
                sprintf('%s cannot carry a fractional amount (%s).', $currency, $amount),
            );
        }

        return $minor;
    }

    /** The inverse, for reading a gateway's figures back. */
    public static function fromMinorUnits(int $minor, string $currency = self::BASE): float
    {
        return self::isZeroDecimal(strtoupper($currency))
            ? (float) $minor
            : round($minor / 100, 2);
    }

    /**
     * The currency this request's prices are being quoted in.
     *
     * Bound by {@see \App\Http\Middleware\ResolveDisplayCurrency}. Falls back
     * to the canonical currency outside a request — a queue worker, a console
     * command, a test that has not asked for anything else.
     */
    public static function displayCurrency(): string
    {
        $key = \App\Http\Middleware\ResolveDisplayCurrency::KEY;

        return app()->bound($key) ? Currency::normalise(app()->make($key)) : self::BASE;
    }

    public static function supported(): array
    {
        return Currency::SUPPORTED;
    }

    /**
     * Convert a canonical amount for display.
     *
     * Every rate this touches comes from {@see Currency}, which reads the one
     * an administrator set. There is no rate in this file and no arithmetic
     * that could become one.
     */
    public static function convert(float $amount, string $currency = self::BASE): float
    {
        return Currency::fromBase($amount, $currency);
    }

    /**
     * Build the price payload the storefront renders.
     *
     * Always includes the raw base amount so clients that do their own
     * formatting (the Flutter app) are not forced through the string form.
     */
    public static function payload(?float $current, ?float $was = null): array
    {
        $current = (float) $current;
        $was     = $was !== null ? (float) $was : null;

        $discount = null;
        if ($was !== null && $was > 0 && $was > $current) {
            $discount = (int) round((($was - $current) / $was) * 100);
        }

        $display = self::displayCurrency();
        $rate    = Currency::rate();

        return [
            // What the customer is reading, already converted. The client
            // formats this; it never converts it. Two conversions with two
            // rates is how a basket stops agreeing with the product page it
            // was filled from.
            'currency'         => $display,
            'current'          => Currency::fromBase($current, $display, $rate),
            'was'              => $was !== null ? Currency::fromBase($was, $display, $rate) : null,
            // Computed from the canonical amounts, not the converted ones, so
            // a discount does not drift by a percentage point with the rate.
            'discount_percent' => $discount,

            // The canonical figure, always sent. Anything that has to reason
            // about money rather than print it — a total, a comparison, a
            // reconciliation — uses this and stays currency-independent.
            'base_currency'    => self::BASE,
            'base_current'     => round($current, 2),
            'base_was'         => $was !== null ? round($was, 2) : null,

            // Carried so a client can say "converted at 2,500" where that
            // helps, and so a bug in conversion is visible rather than
            // inferred.
            'exchange_rate'    => $display === self::BASE ? null : $rate,
        ];
    }
}
