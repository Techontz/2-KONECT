<?php

namespace App\Filament\Resources\CurrencyRateResource\Pages;

use App\Filament\Resources\CurrencyRateResource;
use App\Support\Currency;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Log;
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

        // Parsed, not cast.
        //
        // `(float) $data['rate']` was here, and a cast is not a check: PHP
        // turns true into 1.0 and a non-empty array into 1.0 without
        // complaining. Production ended up with a row reading rate 1.000000
        // and note "2800" — written by this line, from a form somebody had
        // typed 2800 into. Whatever arrived, the cast accepted it.
        //
        // The raw value is logged before anything is written, so if it happens
        // again the log names exactly what the form sent rather than leaving
        // it to be inferred from a wrong price weeks later. A rate is not a
        // secret; there is nothing here to redact.
        Log::info('Exchange rate submitted', [
            'raw'   => is_scalar($data['rate'] ?? null) ? $data['rate'] : get_debug_type($data['rate'] ?? null),
            'type'  => get_debug_type($data['rate'] ?? null),
            'by'    => auth()->id(),
        ]);

        $record = Currency::setRate(
            Currency::parseRate($data['rate'] ?? null),
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
