<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductRequestResource\Pages;
use App\Models\ProductRequest;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * The sourcing desk.
 *
 * Every "I can't find it" from the storefront lands here as a job with a
 * reference: reviewed, priced, agreed, ordered, shipped. The buyer sees the
 * same ladder in their account, driven by the status set on this screen.
 */
class ProductRequestResource extends Resource
{
    protected static ?string $model = ProductRequest::class;
    protected static ?string $navigationIcon = 'heroicon-o-magnifying-glass-circle';
    protected static ?string $navigationGroup = 'Sourcing';
    protected static ?string $navigationLabel = 'Product requests';
    protected static ?int $navigationSort = 1;
    protected static ?string $recordTitleAttribute = 'reference';

    public static function getNavigationBadge(): ?string
    {
        $open = static::getModel()::whereIn('status', ['submitted', 'reviewing'])->count();

        return $open > 0 ? (string) $open : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('What they are looking for')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('reference')->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('name')->label('Product')->required()->columnSpan(1),
                    Forms\Components\Textarea::make('description')->rows(3)->columnSpanFull(),
                    Forms\Components\TextInput::make('brand'),
                    Forms\Components\TextInput::make('quantity')->numeric()->minValue(1),
                    Forms\Components\TextInput::make('budget_max')->label('Their budget')->numeric()->prefix('TZS'),
                    Forms\Components\FileUpload::make('image')
                        ->image()->directory('requests')->disk('public')
                        ->label('Reference photo')->columnSpanFull(),
                ]),

            Forms\Components\Section::make('Who to call back')
                ->columns(3)
                ->schema([
                    Forms\Components\TextInput::make('contact_name'),
                    Forms\Components\TextInput::make('contact_phone')->tel(),
                    Forms\Components\TextInput::make('contact_email')->email(),
                    Forms\Components\TextInput::make('delivery_city')->label('Deliver to'),
                ]),

            Forms\Components\Section::make('Progress')
                ->columns(3)
                ->schema([
                    Forms\Components\Select::make('status')
                        ->options(collect(ProductRequest::STATUSES)
                            ->mapWithKeys(fn ($s) => [$s => ucfirst(str_replace('_', ' ', $s))])
                            ->all())
                        ->required()
                        ->native(false),

                    Forms\Components\TextInput::make('quoted_price')
                        ->label('Quote')->numeric()->prefix('TZS')
                        ->helperText('Setting this stamps the quote date.')
                        ->live(onBlur: true)
                        ->afterStateUpdated(function ($state, Forms\Set $set) {
                            if ($state !== null && $state !== '') {
                                $set('quoted_at', now());
                            }
                        }),

                    Forms\Components\DateTimePicker::make('quoted_at')->label('Quoted at'),
                    Forms\Components\TextInput::make('quoted_eta_min_days')->label('Arrives in (from, days)')->numeric(),
                    Forms\Components\TextInput::make('quoted_eta_max_days')->label('Arrives in (to, days)')->numeric(),
                    Forms\Components\Textarea::make('admin_note')
                        ->label('Note to the customer')
                        ->rows(2)
                        ->columnSpanFull(),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\ImageColumn::make('image')->label('')->square()->width(48)->height(48),

                Tables\Columns\TextColumn::make('reference')->searchable()->copyable()->weight('bold')
                    ->description(fn (ProductRequest $r) => $r->created_at?->diffForHumans()),

                Tables\Columns\TextColumn::make('name')->label('Wanted')->searchable()->limit(40)
                    ->description(fn (ProductRequest $r) => $r->brand),

                Tables\Columns\TextColumn::make('quantity')->label('Qty')->alignCenter(),

                Tables\Columns\TextColumn::make('contact_name')->label('Customer')->searchable()
                    ->description(fn (ProductRequest $r) => $r->contact_phone),

                Tables\Columns\TextColumn::make('budget_max')->label('Budget')->money('TZS')->toggleable(),
                Tables\Columns\TextColumn::make('quoted_price')->label('Quoted')->money('TZS'),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (string $s) => ucfirst(str_replace('_', ' ', $s)))
                    ->color(fn (string $s) => match ($s) {
                        'completed' => 'success',
                        'unavailable', 'cancelled' => 'danger',
                        'submitted' => 'warning',
                        default     => 'info',
                    })
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->options(
                    collect(ProductRequest::STATUSES)->mapWithKeys(fn ($s) => [$s => ucfirst($s)])->all()
                ),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),

                Tables\Actions\Action::make('startSourcing')
                    ->label('Start sourcing')
                    ->icon('heroicon-m-globe-alt')
                    ->color('info')
                    ->visible(fn (ProductRequest $r) => in_array($r->status, ['submitted', 'reviewing'], true))
                    ->action(function (ProductRequest $r) {
                        $r->update(['status' => 'sourcing']);
                        Notification::make()->success()->title("{$r->reference} moved to sourcing")->send();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListProductRequests::route('/'),
            'edit'  => Pages\EditProductRequest::route('/{record}/edit'),
        ];
    }
}
