<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductOffer;
use App\Support\Sourcing;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo sourcing data for a development database.
 *
 * The import experience cannot be seen until some of the catalogue is
 * actually sourced abroad, and on a fresh install every one of the 2,857
 * products is local. This seeder marks a deterministic slice as imported and
 * attaches an imported alternative to another slice, so both the "order from
 * abroad" listings and the local-versus-imported price comparison render
 * against real rows through the real API.
 *
 * NOT production data. It edits existing catalogue rows, so it is opt-in:
 *
 *     php artisan db:seed --class=ImportSourcingDemoSeeder
 *     php artisan db:seed --class=ImportSourcingDemoSeeder -- --revert
 *
 * Deterministic on product id, so re-running it produces the same result
 * rather than drifting, and `--revert` puts the catalogue back to all-local.
 */
class ImportSourcingDemoSeeder extends Seeder
{
    /** Where imports come from, and how they travel. */
    private const ROUTES = [
        ['country' => 'CN', 'method' => 'air', 'min' => 8,  'max' => 14, 'discount' => 0.28],
        ['country' => 'CN', 'method' => 'sea', 'min' => 30, 'max' => 45, 'discount' => 0.38],
        ['country' => 'AE', 'method' => 'air', 'min' => 5,  'max' => 9,  'discount' => 0.18],
        ['country' => 'TR', 'method' => 'air', 'min' => 7,  'max' => 12, 'discount' => 0.22],
        ['country' => 'US', 'method' => 'air', 'min' => 10, 'max' => 18, 'discount' => 0.15],
        ['country' => 'GB', 'method' => 'air', 'min' => 9,  'max' => 16, 'discount' => 0.16],
    ];

    public function run(): void
    {
        if (in_array('--revert', (array) ($_SERVER['argv'] ?? []), true)) {
            $this->revert();

            return;
        }

        $imported = 0;
        $offered  = 0;

        Product::query()->orderBy('id')->chunkById(500, function ($products) use (&$imported, &$offered) {
            foreach ($products as $product) {
                // Deterministic slice: one in seven becomes an import-only
                // listing, one in five gains an imported alternative. Nothing
                // random, so the catalogue looks the same on every machine.
                $bucket = $product->id % 35;

                if ($bucket < 5) {
                    $route = self::ROUTES[$product->id % count(self::ROUTES)];

                    $product->forceFill([
                        'availability'        => Sourcing::IMPORT,
                        'source_country'      => $route['country'],
                        'shipping_method'     => $route['method'],
                        'lead_time_min_days'  => $route['min'],
                        'lead_time_max_days'  => $route['max'],
                        'fulfilment_location' => null,
                    ])->save();

                    $imported++;

                    continue;
                }

                if ($bucket < 12 && ! $product->offers()->exists() && $product->new_price > 0) {
                    $route = self::ROUTES[($product->id + 3) % count(self::ROUTES)];

                    ProductOffer::create([
                        'product_id'         => $product->id,
                        'vendor_id'          => null,
                        'availability'       => Sourcing::IMPORT,
                        'source_country'     => $route['country'],
                        'shipping_method'    => $route['method'],
                        'price'              => round((float) $product->new_price * (1 - $route['discount']), -2),
                        'stock'              => 0,
                        'lead_time_min_days' => $route['min'],
                        'lead_time_max_days' => $route['max'],
                        'is_active'          => true,
                    ]);

                    $offered++;
                }
            }
        });

        $this->command?->info("Marked {$imported} products as imported and added {$offered} imported alternatives.");
    }

    /** Put the catalogue back to how it started. */
    private function revert(): void
    {
        DB::table('product_offers')->delete();

        DB::table('products')->update([
            'availability'       => Sourcing::LOCAL,
            'source_country'     => 'TZ',
            'shipping_method'    => null,
            'lead_time_min_days' => 1,
            'lead_time_max_days' => 3,
        ]);

        $this->command?->info('Catalogue reverted to local-only.');
    }
}
