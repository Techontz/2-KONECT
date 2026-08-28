<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CurrencyRateResource\Pages;
use App\Models\CurrencyRate;
use App\Support\Currency;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Settings → Currency.
 *
 * The rate every conversion in the marketplace uses, and every rate it has
 * ever used, in one place — because they are the same table. Setting a new
 * rate inserts a row and retires the old one, so the list below is the audit
 * trail: what changed, from what, by whom, and when.
 *
 * Nothing here fetches a market rate and nothing here ever will. A marketplace
 * that repriced itself whenever a wire service moved would show a customer one
 * figure on the product page and another in the basket, and would owe its
 * sellers a different amount each time anyone refreshed the screen.
 *
 * Rows are deliberately not editable. Correcting a rate in place would erase
 * the record of what prices were actually shown while it was wrong, which is
 * the one thing this table exists to preserve. A mistake is fixed by setting
 * the right rate, which leaves both the mistake and the correction on record.
 */
class CurrencyRateResource extends Resource
{
    protected static ?string $model = CurrencyRate::class;

    protected static ?string $navigationGroup = 'Settings';
    // Last in the Settings group. It was 2, which collided with Payment
    // Methods and left the order down to whichever Filament happened to
    // register first — a menu that moves between deployments for no reason
    // anyone can see.
    protected static ?int $navigationSort = 10;
    protected static ?string $navigationIcon = 'heroicon-o-currency-dollar';
    protected static ?string $navigationLabel = 'Currency';
    protected static ?string $modelLabel = 'exchange rate';
    protected static ?string $pluralModelLabel = 'currency';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Set the marketplace exchange rate')
                ->description(
                    'Every price 2KONECT converts uses this rate and nothing else. '
                    . 'It is not taken from any market feed. Prices update as soon as you save.'
                )
                ->schema([
                    Forms\Components\TextInput::make('rate')
                        ->label('1 USD =')
                        ->suffix('TZS')
                        ->numeric()
                        ->required()
                        // ---- step and min, and why they matter ----
                        //
                        // A number input's valid values are min + n*step. This
                        // was min=0.000001 with step=1, so the only values the
                        // browser would accept were 0.000001, 1.000001,
                        // 2.000001 … — 2500 was refused outright, and the
                        // browser helpfully offered "the two nearest valid
                        // values are 0.000001 and 1.000001".
                        //
                        // Somebody picked 1.000001. That became the live
                        // marketplace rate, and every USD price on the site was
                        // wrong by a factor of 2,500 until it was noticed. A
                        // broken step on one form quietly repriced a catalogue.
                        //
                        // 0.01 admits every rate anybody would type — 1, 100,
                        // 2500, 2500.50, 2700 — and leaves judgement about
                        // whether a value makes sense to the rule below, which
                        // can explain itself. A browser step error cannot.
                        ->step(\App\Support\Currency::RATE_INPUT_STEP)
                        ->minValue(\App\Support\Currency::RATE_INPUT_MIN)
                        ->rule(fn () => function (string $attribute, $value, \Closure $fail) {
                            if (! is_numeric($value)) {
                                $fail('Enter a number, for example 2500.');

                                return;
                            }

                            if ((float) $value <= 0) {
                                $fail('An exchange rate must be greater than zero.');

                                return;
                            }

                            if ((float) $value < \App\Support\Currency::MINIMUM_PLAUSIBLE_RATE) {
                                $fail(sprintf(
                                    'A rate below 1 looks inverted. Enter how many Tanzanian Shillings one '
                                    . 'US dollar is worth — for example 2500. You may have meant %s.',
                                    rtrim(rtrim(number_format(1 / (float) $value, 2), '0'), '.'),
                                ));
                            }
                        })
                        ->helperText(
                            'How many Tanzanian Shillings one US dollar is worth — for example 2500, '
                            . 'or 2500.50. Not the other way round: 0.0004 is the reciprocal and is refused.'
                        ),

                    Forms\Components\TextInput::make('note')
                        ->label('Reason for the change')
                        ->maxLength(200)
                        ->helperText('Optional, and kept forever. Future you will be glad of it.'),
                ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('rate')
                    ->label('1 USD =')
                    ->formatStateUsing(fn ($state) => number_format((float) $state, 2) . ' TZS')
                    ->weight('bold'),

                Tables\Columns\TextColumn::make('previous_rate')
                    ->label('Replaced')
                    ->formatStateUsing(fn ($state) => $state === null
                        ? '— (first rate set)'
                        : number_format((float) $state, 2) . ' TZS')
                    ->color('gray'),

                Tables\Columns\IconColumn::make('is_active')
                    ->label('In use')
                    ->boolean(),

                Tables\Columns\TextColumn::make('author.name')
                    ->label('Changed by')
                    ->default('— (system)'),

                Tables\Columns\TextColumn::make('note')
                    ->label('Reason')
                    ->limit(40)
                    ->toggleable(),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('When')
                    ->dateTime('j M Y, H:i')
                    ->sortable(),
            ])
            ->actions([
                // Deliberately no edit and no delete. The history is the point.
                Tables\Actions\ViewAction::make(),
            ])
            ->bulkActions([])
            ->emptyStateHeading('No exchange rate has been set')
            ->emptyStateDescription(
                'Until one is, conversions use a placeholder of 1 USD = '
                . number_format(Currency::FALLBACK_RATE) . ' TZS. Set the real rate.'
            );
    }

    /** New rates only. History is never rewritten. */
    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('author');
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListCurrencyRates::route('/'),
            'create' => Pages\CreateCurrencyRate::route('/create'),
        ];
    }
}
