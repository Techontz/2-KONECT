<?php

namespace App\Filament\Resources\CurrencyRateResource\Pages;

use App\Filament\Resources\CurrencyRateResource;
use App\Support\Currency;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

/**
 * Setting a rate goes through the currency service, not through Eloquent.
 *
 * The service is what retires the previous rate, records what was replaced and
 * clears the cached catalogue — three things that must happen together, and
 * would be three things to remember if this page wrote the row itself.
 */
class CreateCurrencyRate extends CreateRecord
{
    protected static string $resource = CurrencyRateResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        $previous = Currency::rate();

        $record = Currency::setRate(
            (float) $data['rate'],
            auth()->id(),
            $data['note'] ?? null,
        );

        Notification::make()
            ->title('Exchange rate updated')
            ->body(sprintf(
                'Was 1 USD = %s TZS, now 1 USD = %s TZS. Every converted price uses the new rate from now on; '
                . 'orders already placed keep the rate they were placed at.',
                number_format($previous, 2),
                number_format((float) $record->rate, 2),
            ))
            ->success()
            ->persistent()
            ->send();

        return $record;
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
