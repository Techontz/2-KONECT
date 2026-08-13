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
     * Rates expressed as "1 TZS = X target". Override in config/money.php to
     * plug in a live feed without touching any calling code.
     */
    public static function rates(): array
    {
        return config('money.rates', [
            'TZS' => 1.0,
            'USD' => 0.000387,
        ]);
    }

    public static function supported(): array
    {
        return array_keys(self::rates());
    }

    /** Convert a base-currency (TZS) amount into `$currency`. */
    public static function convert(float $amount, string $currency = self::BASE): float
    {
        $rate = self::rates()[strtoupper($currency)] ?? 1.0;

        return $amount * $rate;
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

        return [
            'currency'         => self::BASE,
            'current'          => round($current, 2),
            'was'              => $was !== null ? round($was, 2) : null,
            'discount_percent' => $discount,
        ];
    }
}
