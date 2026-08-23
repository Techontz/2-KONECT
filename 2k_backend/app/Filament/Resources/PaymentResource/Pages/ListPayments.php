<?php

namespace App\Filament\Resources\PaymentResource\Pages;

use App\Filament\Resources\PaymentResource;
use Filament\Resources\Pages\ListRecords;

class ListPayments extends ListRecords
{
    protected static string $resource = PaymentResource::class;

    /** Read-only: no "New payment" button, because a payment is not created here. */
    protected function getHeaderActions(): array
    {
        return [];
    }
}
