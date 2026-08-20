<?php

namespace App\Filament\Resources\OrderResource\Pages;

use App\Filament\Resources\OrderResource;
use App\Models\Order;
use Filament\Resources\Pages\ListRecords;

class ListOrders extends ListRecords
{
    protected static string $resource = OrderResource::class;

    /** Status tabs, each showing how many orders sit in that stage. */
    public function getTabs(): array
    {
        $counts = Order::query()
            ->selectRaw('status, COUNT(*) AS total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $tab = function (string $label, ?string $status) use ($counts) {
            $tab = \Filament\Resources\Components\Tab::make($label);

            if ($status !== null) {
                $tab->modifyQueryUsing(fn ($query) => $query->where('status', $status))
                    ->badge($counts[$status] ?? 0);
            } else {
                $tab->badge($counts->sum());
            }

            return $tab;
        };

        return [
            'all'        => $tab('All', null),
            'pending'    => $tab('Pending', 'pending'),
            'processing' => $tab('Processing', 'processing'),
            'shipped'    => $tab('Shipped', 'shipped'),
            'completed'  => $tab('Completed', 'completed'),
            'cancelled'  => $tab('Cancelled', 'cancelled'),
        ];
    }
}
