<?php

namespace App\Support;

/**
 * Tanzanian phone numbers, normalised once and in one place.
 *
 * Seller-entered numbers in the catalogue are inconsistent — `0764224477`,
 * `+255753081578`, `9087654321`, and even `072c224b08` — so every consumer
 * needs the same answer to "is this actually dialable, and what is the
 * international form?". Guessing per call site is how a `wa.me` link ends up
 * pointing at a number that does not exist.
 */
class Phone
{
    /** Tanzania's country calling code. */
    private const COUNTRY = '255';

    /**
     * Reduce a stored number to E.164 digits, or null when it cannot be one.
     *
     * Accepts the three shapes sellers actually use:
     *   0764224477      → 255764224477
     *   +255764224477   → 255764224477
     *   764224477       → 255764224477
     *
     * Anything else — letters, too few digits, an unknown country — returns
     * null so the caller hides the action instead of publishing a bad link.
     */
    public static function normalise(?string $raw): ?string
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return null;
        }

        // A number containing letters was mistyped; it is not recoverable.
        if (preg_match('/[a-z]/i', $raw)) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return null;
        }

        // Already international.
        if (str_starts_with($digits, self::COUNTRY)) {
            $local = substr($digits, strlen(self::COUNTRY));
        } elseif (str_starts_with($digits, '0')) {
            $local = substr($digits, 1);
        } else {
            $local = $digits;
        }

        // Tanzanian mobile numbers are nine digits after the country code and
        // begin with 6 or 7. Landlines and short codes cannot receive
        // WhatsApp, and a wrong length means the entry is simply broken.
        if (! preg_match('/^[67]\d{8}$/', $local)) {
            return null;
        }

        return self::COUNTRY . $local;
    }

    /** True when the number can actually be dialled. */
    public static function isValid(?string $raw): bool
    {
        return self::normalise($raw) !== null;
    }

    /** `+255764224477`, for display and for `tel:` links. */
    public static function e164(?string $raw): ?string
    {
        $normalised = self::normalise($raw);
        return $normalised ? '+' . $normalised : null;
    }

    /**
     * WhatsApp deep link, or null when the number cannot receive one.
     *
     * `wa.me` resolves to the app on a handset and to WhatsApp Web on a
     * desktop, so one URL covers both without sniffing the user agent.
     */
    public static function whatsapp(?string $raw, ?string $message = null): ?string
    {
        $normalised = self::normalise($raw);
        if (! $normalised) {
            return null;
        }

        $url = 'https://wa.me/' . $normalised;

        return $message
            ? $url . '?text=' . rawurlencode($message)
            : $url;
    }

    /** `+255 764 224 477` — grouped for reading, not for dialling. */
    public static function pretty(?string $raw): ?string
    {
        $normalised = self::normalise($raw);
        if (! $normalised) {
            return null;
        }

        $local = substr($normalised, strlen(self::COUNTRY));

        return sprintf('+%s %s %s %s',
            self::COUNTRY,
            substr($local, 0, 3),
            substr($local, 3, 3),
            substr($local, 6),
        );
    }
}
