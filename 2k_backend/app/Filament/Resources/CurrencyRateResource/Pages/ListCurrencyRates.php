<?php

namespace App\Filament\Resources\CurrencyRateResource\Pages;

use App\Filament\Resources\CurrencyRateResource;
use App\Support\Currency;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListCurrencyRates extends ListRecords
{
    protected static string $resource = CurrencyRateResource::class;

    public function getSubheading(): ?string
    {
        $rate = number_format(Currency::rate(), 2);

        return Currency::isConfigured()
            ? "In use: 1 USD = {$rate} TZS. All marketplace conversions use this manually configured rate."
            : "No rate set — using the placeholder 1 USD = {$rate} TZS. Set the real rate below.";
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()->label('Set a new rate'),
        ];
    }
}
