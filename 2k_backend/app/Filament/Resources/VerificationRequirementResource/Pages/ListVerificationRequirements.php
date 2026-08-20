<?php

namespace App\Filament\Resources\VerificationRequirementResource\Pages;

use App\Filament\Resources\VerificationRequirementResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListVerificationRequirements extends ListRecords
{
    protected static string $resource = VerificationRequirementResource::class;

    protected function getHeaderActions(): array
    {
        return [Actions\CreateAction::make()];
    }
}
