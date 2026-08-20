<?php

namespace App\Filament\Widgets;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\DB;

/**
 * Top-line marketplace health.
 *
 * Every figure is a live aggregate over the real tables — nothing here is
 * seeded, sampled or hard-coded. Queries are cached for a minute so opening
 * the dashboard repeatedly does not hammer the database.
 */
class MarketplaceOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $stats = cache()->remember('admin.overview.v1', 60, function () {
            // Only revenue that was actually earned — cancelled orders are
            // excluded, otherwise the headline number flatters the business.
            $earned = Order::whereNotIn('status', ['cancelled'])->sum('total');
            $pending = Order::where('status', 'pending')->count();

            return [
                'products'        => Product::count(),
                'in_stock'        => Product::where('stock', '>', 0)->count(),
                'out_of_stock'    => Product::where('stock', '<=', 0)->count(),
                'low_stock'       => Product::whereBetween('stock', [1, 5])->count(),
                'vendors'         => Vendor::count(),
                'vendors_pending' => Vendor::where('is_approved', false)->count(),
                'customers'       => User::where('role', 'user')->count(),
                'orders'          => Order::distinct('reference')->count('reference'),
                'orders_pending'  => $pending,
                'revenue'         => (float) $earned,
                'revenue_30d'     => (float) Order::whereNotIn('status', ['cancelled'])
                    ->where('created_at', '>=', now()->subDays(30))
                    ->sum('total'),
            ];
        });

        return [
            Stat::make('Revenue', 'TZS ' . number_format($stats['revenue']))
                ->description('TZS ' . number_format($stats['revenue_30d']) . ' in the last 30 days')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success')
                ->chart($this->revenueTrend()),

            Stat::make('Orders', number_format($stats['orders']))
                ->description($stats['orders_pending'] . ' awaiting action')
                ->descriptionIcon('heroicon-m-shopping-bag')
                ->color($stats['orders_pending'] > 0 ? 'warning' : 'primary'),

            Stat::make('Products', number_format($stats['products']))
                ->description($stats['in_stock'] . ' in stock · ' . $stats['out_of_stock'] . ' sold out')
                ->descriptionIcon('heroicon-m-cube')
                ->color($stats['out_of_stock'] > 0 ? 'warning' : 'success'),

            Stat::make('Vendors', number_format($stats['vendors']))
                ->description(
                    $stats['vendors_pending'] > 0
                        ? $stats['vendors_pending'] . ' waiting for approval'
                        : 'All vendors approved'
                )
                ->descriptionIcon('heroicon-m-building-storefront')
                ->color($stats['vendors_pending'] > 0 ? 'danger' : 'success'),

            Stat::make('Customers', number_format($stats['customers']))
                ->description('Registered shoppers')
                ->descriptionIcon('heroicon-m-users')
                ->color('primary'),

            Stat::make('Low stock', number_format($stats['low_stock']))
                ->description('Products with 5 or fewer units')
                ->descriptionIcon('heroicon-m-exclamation-triangle')
                ->color($stats['low_stock'] > 0 ? 'warning' : 'success'),
        ];
    }

    /** Daily revenue for the last 14 days, for the headline sparkline. */
    private function revenueTrend(): array
    {
        return cache()->remember('admin.revenue.trend.v1', 300, function () {
            $rows = Order::query()
                ->whereNotIn('status', ['cancelled'])
                ->where('created_at', '>=', now()->subDays(14))
                ->select(DB::raw('DATE(created_at) AS day'), DB::raw('SUM(total) AS total'))
                ->groupBy('day')
                ->orderBy('day')
                ->pluck('total', 'day');

            $series = [];
            for ($offset = 13; $offset >= 0; $offset--) {
                $day = now()->subDays($offset)->toDateString();
                $series[] = (float) ($rows[$day] ?? 0);
            }

            return $series;
        });
    }
}
