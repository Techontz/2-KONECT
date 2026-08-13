<?php

namespace App\Filament\Widgets;

use App\Models\Order;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Facades\DB;

/**
 * Revenue and order volume over time, from real order rows.
 * The range is switchable so the same widget covers a week and a year.
 */
class SalesChart extends ChartWidget
{
    protected static ?string $heading = 'Sales';
    protected static ?int $sort = 2;
    protected static ?string $maxHeight = '260px';

    // Without this the chart takes one column of the two-column grid and the
    // other half of the row is left empty, which reads as a missing widget.
    protected int|string|array $columnSpan = 'full';

    public ?string $filter = '30';

    protected function getFilters(): ?array
    {
        return [
            '7'   => 'Last 7 days',
            '30'  => 'Last 30 days',
            '90'  => 'Last 90 days',
            '365' => 'Last 12 months',
        ];
    }

    protected function getData(): array
    {
        $days = (int) ($this->filter ?? 30);

        // Long ranges are grouped by month; anything shorter stays daily,
        // otherwise a year of daily points is unreadable.
        $groupByMonth = $days > 90;

        $rows = Order::query()
            ->whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', now()->subDays($days))
            ->select(
                DB::raw($groupByMonth
                    ? "DATE_FORMAT(created_at, '%Y-%m') AS bucket"
                    : 'DATE(created_at) AS bucket'),
                DB::raw('SUM(total) AS revenue'),
                DB::raw('COUNT(DISTINCT reference) AS orders')
            )
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get();

        $labels  = [];
        $revenue = [];
        $orders  = [];

        foreach ($this->buckets($days, $groupByMonth) as $bucket => $label) {
            $row = $rows->firstWhere('bucket', $bucket);
            $labels[]  = $label;
            $revenue[] = (float) ($row->revenue ?? 0);
            $orders[]  = (int) ($row->orders ?? 0);
        }

        return [
            'datasets' => [
                [
                    'label' => 'Revenue (TZS)',
                    'data' => $revenue,
                    'borderColor' => '#059669',
                    'backgroundColor' => 'rgba(5, 150, 105, 0.12)',
                    'fill' => true,
                    'tension' => 0.35,
                    'yAxisID' => 'y',
                ],
                [
                    'label' => 'Orders',
                    'data' => $orders,
                    'borderColor' => '#3866df',
                    'backgroundColor' => 'rgba(56, 102, 223, 0.12)',
                    'fill' => false,
                    'tension' => 0.35,
                    'yAxisID' => 'y1',
                ],
            ],
            'labels' => $labels,
        ];
    }

    /**
     * Build a complete, gap-free set of buckets so days with no sales render
     * as zero rather than being silently dropped from the line.
     *
     * @return array<string, string> bucket key => display label
     */
    private function buckets(int $days, bool $byMonth): array
    {
        $buckets = [];

        if ($byMonth) {
            $months = (int) ceil($days / 30);
            for ($offset = $months - 1; $offset >= 0; $offset--) {
                $date = now()->subMonths($offset);
                $buckets[$date->format('Y-m')] = $date->format('M Y');
            }

            return $buckets;
        }

        for ($offset = $days - 1; $offset >= 0; $offset--) {
            $date = now()->subDays($offset);
            $buckets[$date->toDateString()] = $date->format('j M');
        }

        return $buckets;
    }

    protected function getType(): string
    {
        return 'line';
    }

    protected function getOptions(): array
    {
        return [
            'scales' => [
                'y'  => ['position' => 'left', 'title' => ['display' => true, 'text' => 'Revenue']],
                'y1' => [
                    'position' => 'right',
                    'title' => ['display' => true, 'text' => 'Orders'],
                    'grid' => ['drawOnChartArea' => false],
                ],
            ],
        ];
    }
}
