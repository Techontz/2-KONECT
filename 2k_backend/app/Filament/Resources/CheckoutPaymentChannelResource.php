<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CheckoutPaymentChannelResource\Pages;
use App\Models\CheckoutPaymentChannel;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Where the Lipa Namba lives.
 *
 * Sits beside "Payment Methods" in Settings but is a different thing, and the
 * labels say so: that resource is how a *seller* is paid out, this is how a
 * *customer* pays 2KONECT.
 *
 * The number is edited here and nowhere else. It is read by the storefront
 * over the API, so changing it takes effect on the next page load — no build,
 * no deployment, and no till number in the frontend repository.
 */
class CheckoutPaymentChannelResource extends Resource
{
    protected static ?string $model = CheckoutPaymentChannel::class;

    protected static ?string $navigationGroup = 'Settings';
    protected static ?int $navigationSort = 1;
    protected static ?string $navigationIcon = 'heroicon-o-banknotes';
    protected static ?string $navigationLabel = 'Customer Payment';
    protected static ?string $modelLabel = 'customer payment channel';
    protected static ?string $pluralModelLabel = 'Customer Payment';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Channel')
                ->description('How customers pay 2KONECT at checkout. This is not the same as Payment Methods, which is how sellers are paid out.')
                ->schema([
                    Forms\Components\TextInput::make('code')
                        ->label('Code')
                        ->helperText('Written to the order. Do not change once orders exist.')
                        ->required()
                        ->maxLength(40)
                        ->disabledOn('edit'),

                    Forms\Components\TextInput::make('label')
                        ->label('Display name')
                        ->helperText('What the customer sees, e.g. "Lipa Namba".')
                        ->required()
                        ->maxLength(80),

                    Forms\Components\TextInput::make('merchant_name')
                        ->label('Business / merchant name')
                        ->helperText('The name the customer should see on their phone before confirming.')
                        ->maxLength(120),

                    Forms\Components\TextInput::make('number')
                        ->label('Lipa Namba / number')
                        ->helperText('The number customers pay to. Shown on the checkout exactly as typed here.')
                        ->maxLength(60),

                    Forms\Components\Textarea::make('instructions')
                        ->label('Instructions')
                        ->helperText('Shown under the number. Tell the customer exactly what to do.')
                        ->rows(3),
                ])->columns(2),

            Forms\Components\Section::make('Availability')
                ->schema([
                    Forms\Components\Toggle::make('is_active')
                        ->label('Active')
                        ->helperText('Off until the number above is correct. An inactive channel is never offered and is rejected if requested.')
                        ->default(false),

                    Forms\Components\Toggle::make('requires_reference')
                        ->label('Customer must send a transaction reference')
                        ->default(true),

                    Forms\Components\Toggle::make('requires_verification')
                        ->label('An administrator must confirm the payment')
                        ->helperText('Leave on for any channel paid by hand. Only switch off for a gateway that confirms itself.')
                        ->default(true),

                    Forms\Components\TextInput::make('sort_order')
                        ->label('Order shown')
                        ->numeric()
                        ->default(0),
                ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                Tables\Columns\TextColumn::make('label')->label('Channel')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('code')->badge()->color('gray'),
                Tables\Columns\TextColumn::make('number')
                    ->label('Number')
                    ->placeholder('not set')
                    ->copyable(),
                Tables\Columns\TextColumn::make('merchant_name')->label('Merchant')->placeholder('—'),
                Tables\Columns\IconColumn::make('is_active')->label('Active')->boolean(),
                Tables\Columns\IconColumn::make('requires_verification')->label('Manual check')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListCheckoutPaymentChannels::route('/'),
            'create' => Pages\CreateCheckoutPaymentChannel::route('/create'),
            'edit'   => Pages\EditCheckoutPaymentChannel::route('/{record}/edit'),
        ];
    }
}
