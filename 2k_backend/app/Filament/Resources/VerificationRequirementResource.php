<?php

namespace App\Filament\Resources;

use App\Filament\Resources\VerificationRequirementResource\Pages;
use App\Models\VerificationRequirement;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * What sellers must submit to earn the verified checkmark.
 *
 * Editable here so the paperwork can change with the business without a code
 * change — adding "Tax certificate" is a row, not a deploy.
 */
class VerificationRequirementResource extends Resource
{
    protected static ?string $model = VerificationRequirement::class;
    protected static ?string $navigationIcon = 'heroicon-o-clipboard-document-check';
    protected static ?string $navigationGroup = 'Sellers';
    protected static ?int $navigationSort = 2;
    protected static ?string $navigationLabel = 'Verification requirements';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')
                ->label('Requirement')
                ->placeholder('e.g. Business licence')
                ->required()
                ->maxLength(120),

            Forms\Components\Select::make('document_type')
                ->label('Type')
                ->options([
                    'file' => 'File upload (photo or PDF)',
                    'text' => 'Reference number (e.g. TIN)',
                ])
                ->default('file')
                ->required()
                ->native(false),

            Forms\Components\Textarea::make('description')
                ->label('Guidance for the seller')
                ->helperText('Explain what to upload and why. Shown on the seller dashboard.')
                ->rows(2)
                ->columnSpanFull(),

            Forms\Components\Toggle::make('is_required')
                ->label('Mandatory')
                ->helperText('Optional requirements can be skipped by sellers it does not apply to.')
                ->default(true),

            Forms\Components\Toggle::make('is_active')->label('Active')->default(true),

            Forms\Components\TextInput::make('sort_order')->label('Order')->numeric()->default(0),
        ])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->reorderable('sort_order')
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->description(fn (VerificationRequirement $record) => $record->description)
                    ->searchable(),
                Tables\Columns\TextColumn::make('document_type')
                    ->label('Type')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => $state === 'file' ? 'File' : 'Reference'),
                Tables\Columns\IconColumn::make('is_required')->label('Mandatory')->boolean(),
                Tables\Columns\IconColumn::make('is_active')->label('Active')->boolean(),
                Tables\Columns\TextColumn::make('documents_count')->counts('documents')->label('Submitted'),
            ])
            ->actions([Tables\Actions\EditAction::make()])
            ->bulkActions([Tables\Actions\BulkActionGroup::make([Tables\Actions\DeleteBulkAction::make()])]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListVerificationRequirements::route('/'),
            'create' => Pages\CreateVerificationRequirement::route('/create'),
            'edit'   => Pages\EditVerificationRequirement::route('/{record}/edit'),
        ];
    }
}
