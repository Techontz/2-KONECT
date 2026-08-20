<?php

namespace App\Support;

/**
 * Where a product is, and what that means for the buyer.
 *
 * 2KONECT sells the same catalogue two ways: stock already in Tanzania, which
 * arrives in days, and stock sourced abroad, which is cheaper but travels
 * first. Every screen has to make that difference obvious, so the wording,
 * the flags, the countries and the default lead times are defined once here
 * and rendered from the payload rather than re-invented per surface.
 */
class Sourcing
{
    public const LOCAL  = 'local';
    public const IMPORT = 'import';

    /** The market the storefront currently delivers into. */
    public const HOME_COUNTRY = 'TZ';

    /**
     * Countries 2KONECT sources from or sells into.
     *
     * Deliberately a list rather than a hard-coded "Tanzania" check: the same
     * data drives the origin badge today and a second market later.
     */
    public const COUNTRIES = [
        'TZ' => ['name' => 'Tanzania',       'flag' => '🇹🇿'],
        'KE' => ['name' => 'Kenya',          'flag' => '🇰🇪'],
        'UG' => ['name' => 'Uganda',         'flag' => '🇺🇬'],
        'RW' => ['name' => 'Rwanda',         'flag' => '🇷🇼'],
        'CN' => ['name' => 'China',          'flag' => '🇨🇳'],
        'AE' => ['name' => 'UAE',            'flag' => '🇦🇪'],
        'TR' => ['name' => 'Türkiye',        'flag' => '🇹🇷'],
        'IN' => ['name' => 'India',          'flag' => '🇮🇳'],
        'GB' => ['name' => 'United Kingdom', 'flag' => '🇬🇧'],
        'US' => ['name' => 'United States',  'flag' => '🇺🇸'],
        'ZA' => ['name' => 'South Africa',   'flag' => '🇿🇦'],
    ];

    /** Transit modes, and how long each typically takes to reach Tanzania. */
    public const SHIPPING_METHODS = [
        'air'  => ['label' => 'Air freight',  'min' => 7,  'max' => 12],
        'sea'  => ['label' => 'Sea freight',  'min' => 30, 'max' => 45],
        'road' => ['label' => 'Road freight', 'min' => 5,  'max' => 10],
    ];

    /** Fallback windows when a listing has not set its own. */
    public const DEFAULT_LEAD_TIME = [
        self::LOCAL  => ['min' => 1, 'max' => 3],
        self::IMPORT => ['min' => 7, 'max' => 14],
    ];

    public static function normalise(?string $availability): string
    {
        return $availability === self::IMPORT ? self::IMPORT : self::LOCAL;
    }

    public static function country(?string $code): ?array
    {
        $code = strtoupper(trim((string) $code));

        if ($code === '' || ! isset(self::COUNTRIES[$code])) {
            return null;
        }

        return ['code' => $code] + self::COUNTRIES[$code];
    }

    /**
     * Resolve the promised window for a listing.
     *
     * Order of preference: what the seller set, then what the transit mode
     * implies, then the type default. A hard-coded "10 days" for everything
     * would be a promise the platform cannot keep.
     */
    public static function leadTime(
        string $availability,
        ?int $min,
        ?int $max,
        ?string $shippingMethod = null,
    ): array {
        $availability = self::normalise($availability);

        if ($min !== null && $max !== null && $max >= $min) {
            return ['min' => $min, 'max' => $max];
        }

        $method = self::SHIPPING_METHODS[$shippingMethod] ?? null;

        if ($availability === self::IMPORT && $method) {
            return ['min' => $method['min'], 'max' => $method['max']];
        }

        return self::DEFAULT_LEAD_TIME[$availability];
    }

    /**
     * The block every card, listing and product page renders to answer
     * "where is it and when do I get it?".
     */
    public static function payload(
        ?string $availability,
        ?string $sourceCountry,
        ?int $leadMin,
        ?int $leadMax,
        ?string $shippingMethod = null,
        ?string $fulfilmentLocation = null,
    ): array {
        $availability = self::normalise($availability);
        $isLocal      = $availability === self::LOCAL;

        $lead    = self::leadTime($availability, $leadMin, $leadMax, $shippingMethod);
        $origin  = self::country($sourceCountry) ?? ($isLocal ? self::country(self::HOME_COUNTRY) : null);
        $method  = self::SHIPPING_METHODS[$shippingMethod] ?? null;

        return [
            'type'     => $availability,
            'is_local' => $isLocal,
            // Short label for a card; the long one is for the product page.
            'label'    => $isLocal ? 'In Tanzania' : 'Order from abroad',
            'headline' => $isLocal
                ? 'Available in Tanzania'
                : ($origin ? 'Sourced from ' . $origin['name'] : 'Sourced internationally'),
            'summary'  => $isLocal
                ? 'In stock locally and ready to ship.'
                : 'We buy it, import it and deliver it to you.',
            'origin'   => $origin,
            'destination' => self::country(self::HOME_COUNTRY),
            'lead_time' => [
                'min'   => $lead['min'],
                'max'   => $lead['max'],
                'label' => self::window($lead['min'], $lead['max']),
            ],
            'shipping_method' => $method ? ['code' => $shippingMethod, 'label' => $method['label']] : null,
            'fulfilment_location' => $fulfilmentLocation ?: ($isLocal ? 'Dar es Salaam' : null),
        ];
    }

    /** "1–3 days", or "3 days" when the window has no spread. */
    public static function window(int $min, int $max): string
    {
        return $min === $max
            ? $min . ' ' . ($min === 1 ? 'day' : 'days')
            : $min . '–' . $max . ' days';
    }
}
