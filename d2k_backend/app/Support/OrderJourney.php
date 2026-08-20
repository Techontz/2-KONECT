<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * The order journey: what the statuses mean, in what order, and how the
 * buyer's tracking screen is built from what actually happened.
 *
 * The existing status vocabulary — pending, processing, shipped, completed,
 * cancelled — is preserved exactly, because the seller console, the Flutter
 * app and 109 live orders all speak it. Imports simply have more stops on the
 * way, so the extra statuses are additive and only ever appear on an order
 * that was flagged as an import at checkout.
 */
class OrderJourney
{
    /* --- statuses shared with the existing system --------------------- */
    public const PENDING    = 'pending';
    public const PROCESSING = 'processing';
    public const SHIPPED    = 'shipped';
    public const COMPLETED  = 'completed';
    public const CANCELLED  = 'cancelled';
    public const REFUNDED   = 'refunded';

    /* --- the extra stops an imported order makes ---------------------- */
    public const DISPATCHED       = 'dispatched';        // handed to the carrier abroad
    public const IN_TRANSIT       = 'in_transit';        // on the way to Tanzania
    public const ARRIVED          = 'arrived_tz';        // landed
    public const CUSTOMS          = 'customs';           // clearing
    public const LOCAL_WAREHOUSE  = 'local_warehouse';   // ready for the last mile
    public const OUT_FOR_DELIVERY = 'out_for_delivery';

    /**
     * Step definitions. `icon` is a name the frontend maps to a glyph, so the
     * backend never has to know what the timeline looks like.
     */
    private const STEPS = [
        self::PENDING          => ['title' => 'Order placed',        'note' => 'We have your order.',                       'icon' => 'receipt'],
        self::PROCESSING       => ['title' => 'Confirmed',           'note' => 'Your order is being prepared.',             'icon' => 'package'],
        self::DISPATCHED       => ['title' => 'Dispatched',          'note' => 'Handed to the international carrier.',      'icon' => 'send'],
        self::IN_TRANSIT       => ['title' => 'In transit',          'note' => 'On the way to Tanzania.',                   'icon' => 'plane'],
        self::ARRIVED          => ['title' => 'Arrived in Tanzania', 'note' => 'The shipment has landed.',                  'icon' => 'flag'],
        self::CUSTOMS          => ['title' => 'Clearing customs',    'note' => 'Import formalities in progress.',           'icon' => 'shield'],
        self::LOCAL_WAREHOUSE  => ['title' => 'At our warehouse',    'note' => 'Ready for local delivery.',                 'icon' => 'warehouse'],
        self::SHIPPED          => ['title' => 'Shipped',             'note' => 'On its way to your address.',               'icon' => 'truck'],
        self::OUT_FOR_DELIVERY => ['title' => 'Out for delivery',    'note' => 'A rider has your package.',                 'icon' => 'truck'],
        self::COMPLETED        => ['title' => 'Delivered',           'note' => 'Package delivered.',                        'icon' => 'check'],
        self::CANCELLED        => ['title' => 'Cancelled',           'note' => 'This order was cancelled.',                 'icon' => 'x'],
        self::REFUNDED         => ['title' => 'Refunded',            'note' => 'Payment returned.',                         'icon' => 'refund'],
    ];

    /** The stops a local delivery makes. */
    private const LOCAL_PATH = [
        self::PENDING, self::PROCESSING, self::SHIPPED, self::OUT_FOR_DELIVERY, self::COMPLETED,
    ];

    /** The stops an import makes. */
    private const IMPORT_PATH = [
        self::PENDING, self::PROCESSING, self::DISPATCHED, self::IN_TRANSIT,
        self::ARRIVED, self::CUSTOMS, self::LOCAL_WAREHOUSE, self::OUT_FOR_DELIVERY, self::COMPLETED,
    ];

    /** Statuses an order may hold, for validation. */
    public static function all(): array
    {
        return array_keys(self::STEPS);
    }

    public static function path(string $fulfilmentType): array
    {
        return $fulfilmentType === Sourcing::IMPORT ? self::IMPORT_PATH : self::LOCAL_PATH;
    }

    public static function label(string $status): string
    {
        return self::STEPS[$status]['title'] ?? ucfirst(str_replace('_', ' ', $status));
    }

    public static function note(string $status): ?string
    {
        return self::STEPS[$status]['note'] ?? null;
    }

    public static function icon(string $status): string
    {
        return self::STEPS[$status]['icon'] ?? 'dot';
    }

    /** Is this order still open, i.e. can it still move forward? */
    public static function isOpen(string $status): bool
    {
        return ! in_array($status, [self::COMPLETED, self::CANCELLED, self::REFUNDED], true);
    }

    /**
     * Has the shipment reached Tanzania? That is the moment the buyer can ask
     * for the last mile, so it is asked in one place.
     */
    public static function hasLanded(string $status, string $fulfilmentType): bool
    {
        if ($fulfilmentType !== Sourcing::IMPORT) {
            return true;
        }

        return in_array(
            $status,
            [self::ARRIVED, self::CUSTOMS, self::LOCAL_WAREHOUSE, self::SHIPPED, self::OUT_FOR_DELIVERY, self::COMPLETED],
            true,
        );
    }

    /**
     * Build the tracking timeline.
     *
     * Every step on the route is returned so the buyer can see the whole
     * journey up front, each marked done / current / upcoming. A step is
     * "done" only when an event was actually recorded for it, or when the
     * order has demonstrably moved past it — the frontend never guesses.
     *
     * @param  Collection<int,object>  $events  Recorded order_events, oldest first.
     */
    public static function timeline(string $status, string $fulfilmentType, Collection $events): array
    {
        $path = self::path($fulfilmentType);

        // Cancellation ends the journey wherever it happened, so the remaining
        // stops are dropped rather than shown as if still coming.
        if (in_array($status, [self::CANCELLED, self::REFUNDED], true)) {
            $reached = $events->pluck('status')->intersect($path)->values()->all();
            $path    = array_values(array_intersect($path, $reached));
            $path[]  = $status;
        }

        $byStatus = $events->keyBy('status');
        $current  = array_search($status, $path, true);

        return collect($path)->values()->map(function (string $step, int $index) use ($byStatus, $current) {
            $event = $byStatus->get($step);

            // Position on the route is what decides the state, never the mere
            // existence of an event: a note recorded against a later stop must
            // not make the journey look further along than the order is.
            $state = match (true) {
                $current !== false && $index <   $current => 'done',
                $current !== false && $index === $current => 'current',
                default                                   => 'upcoming',
            };

            return [
                'status'      => $step,
                'title'       => self::label($step),
                'note'        => $event?->note ?: self::note($step),
                'icon'        => self::icon($step),
                'state'       => $state,
                'location'    => $event?->location,
                'happened_at' => $event?->happened_at
                    ? \Illuminate\Support\Carbon::parse($event->happened_at)->toIso8601String()
                    : null,
            ];
        })->all();
    }
}
