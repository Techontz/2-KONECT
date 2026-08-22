<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * Validates a set of quantity tiers before it is written.
 *
 * The per-field rules (a minimum of at least one, a maximum not below its own
 * minimum, a price not below zero) are ordinary validation and live in the
 * controller's rule array. What cannot be expressed there is the rule that
 * matters most: two tiers must not both claim the same quantity, because then
 * the price of buying seven depends on row order rather than on anything the
 * seller decided.
 */
class PriceTierRules
{
    /**
     * @param  array<int, array{min_quantity: mixed, max_quantity: mixed, unit_price: mixed}>  $tiers
     * @return array<int, array{min_quantity: int, max_quantity: int|null, unit_price: float}>
     *         normalised and sorted by minimum quantity
     *
     * @throws ValidationException
     */
    public static function normalise(array $tiers, string $field = 'price_tiers'): array
    {
        $clean = [];

        foreach (array_values($tiers) as $index => $tier) {
            $min   = (int) ($tier['min_quantity'] ?? 0);
            $rawMax = $tier['max_quantity'] ?? null;
            $max   = ($rawMax === null || $rawMax === '') ? null : (int) $rawMax;
            $price = (float) ($tier['unit_price'] ?? 0);

            if ($min < 1) {
                throw ValidationException::withMessages([
                    "{$field}.{$index}.min_quantity" => 'A tier must start at one unit or more.',
                ]);
            }

            if ($max !== null && $max < $min) {
                throw ValidationException::withMessages([
                    "{$field}.{$index}.max_quantity" => 'The maximum cannot be below the minimum.',
                ]);
            }

            if ($price < 0) {
                throw ValidationException::withMessages([
                    "{$field}.{$index}.unit_price" => 'A price cannot be negative.',
                ]);
            }

            $clean[] = ['min_quantity' => $min, 'max_quantity' => $max, 'unit_price' => round($price, 2)];
        }

        usort($clean, fn ($a, $b) => $a['min_quantity'] <=> $b['min_quantity']);

        // Walk the sorted list and check each tier begins after the previous
        // one ends. Only one tier may be open-ended, and it has to be the last.
        foreach ($clean as $i => $tier) {
            if ($i === 0) {
                continue;
            }

            $previous = $clean[$i - 1];

            if ($previous['max_quantity'] === null) {
                throw ValidationException::withMessages([
                    "{$field}.{$i}.min_quantity" => 'Only the last tier can be open-ended.',
                ]);
            }

            if ($tier['min_quantity'] <= $previous['max_quantity']) {
                throw ValidationException::withMessages([
                    "{$field}.{$i}.min_quantity" => sprintf(
                        'Tiers overlap: %d–%s already covers %d units.',
                        $previous['min_quantity'],
                        $previous['max_quantity'],
                        $tier['min_quantity'],
                    ),
                ]);
            }
        }

        return $clean;
    }
}
