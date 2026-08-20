<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DeliveryRequestResource\Pages;
use App\Models\DeliveryRequest;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * 2KONECT Rides — the last-mile queue.
 *
 * One row per job: who it goes to, where, when, and which rider has it. This
 * is the operational surface the delivery product grows out of.
 */
class DeliveryRequestResource extends Resource
{
    protected static ?string $model = DeliveryRequest::class;
    protected static ?string $navigationIcon = 'heroicon-o-truck';
    protected static ?string $navigationGroup = 'Orders & customers';
    protected static ?string $navigationLabel = 'Deliveries';
    protected static ?int $navigationSort = 2;
    protected static ?string $recordTitleAttribute = 'reference';

    public static function getNavigationBadge(): ?string
    {
        $open = static::getModel()::whereIn('status', ['requested', 'scheduled', 'in_progress'])->count();

        return $open > 0 ? (string) $open : null;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Job')
                ->columns(3)
                ->schema([
                    Forms\Components\TextInput::make('reference')->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('order_reference')->label('Order')->disabled()->dehydrated(false),
                    Forms\Components\Select::make('mode')
                        ->options(['delivery' => 'Deliver to address', 'pickup' => 'Customer collects'])
                        ->native(false),

                    Forms\Components\TextInput::make('recipient_name'),
                    Forms\Components\TextInput::make('recipient_phone')->tel(),
                    Forms\Components\TextInput::make('city'),

                    Forms\Components\Textarea::make('address')->rows(2)->columnSpanFull(),
                    Forms\Components\TextInput::make('pickup_point'),
                    Forms\Components\DatePicker::make('preferred_date'),
                    Forms\Components\TextInput::make('preferred_window'),
                    Forms\Components\Textarea::make('notes')->rows(2)->columnSpanFull(),
                ]),

            Forms\Components\Section::make('Dispatch')
                ->columns(3)
                ->schema([
                    Forms\Components\Select::make('status')
                        ->options(collect(DeliveryRequest::STATUSES)
                            ->mapWithKeys(fn ($s) => [$s => ucfirst(str_replace('_', ' ', $s))])->all())
                        ->required()
                        ->native(false),
                    Forms\Components\TextInput::make('fee')->numeric()->prefix('TZS'),
                    Forms\Components\DateTimePicker::make('completed_at'),
                    Forms\Components\TextInput::make('courier_name')->label('Rider'),
                    Forms\Components\TextInput::make('courier_phone')->label('Rider phone')->tel(),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('reference')->searchable()->copyable()->weight('bold')
                    ->description(fn (DeliveryRequest $d) => $d->created_at?->diffForHumans()),

                Tables\Columns\TextColumn::make('order_reference')->label('Order')->searchable()->copyable(),

                Tables\Columns\TextColumn::make('recipient_name')->label('Recipient')->searchable()
                    ->description(fn (DeliveryRequest $d) => $d->recipient_phone),

                Tables\Columns\TextColumn::make('mode')
                    ->badge()
                    ->formatStateUsing(fn (string $s) => $s === 'pickup' ? 'Collection' : 'Delivery')
                    ->color(fn (string $s) => $s === 'pickup' ? 'gray' : 'info'),

                Tables\Columns\TextColumn::make('address')->limit(36)->toggleable()
                    ->description(fn (DeliveryRequest $d) => $d->pickup_point),

                Tables\Columns\TextColumn::make('preferred_date')->date('j M Y')->label('Wanted')
                    ->description(fn (DeliveryRequest $d) => $d->preferred_window),

                Tables\Columns\TextColumn::make('fee')->money('TZS'),

                Tables\Columns\TextColumn::make('courier_name')->label('Rider')->toggleable(),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (string $s) => ucfirst(str_replace('_', ' ', $s)))
                    ->color(fn (string $s) => match ($s) {
                        'delivered' => 'success',
                        'cancelled' => 'danger',
                        'requested' => 'warning',
                        default     => 'info',
                    })
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->options(
                    collect(DeliveryRequest::STATUSES)->mapWithKeys(fn ($s) => [$s => ucfirst($s)])->all()
                ),
                Tables\Filters\SelectFilter::make('mode')->options([
                    'delivery' => 'Delivery', 'pickup' => 'Collection',
                ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),

                Tables\Actions\Action::make('assign')
                    ->label('Assign rider')
                    ->icon('heroicon-m-user-plus')
                    ->visible(fn (DeliveryRequest $d) => in_array($d->status, ['requested', 'scheduled'], true))
                    ->form([
                        Forms\Components\TextInput::make('courier_name')->label('Rider')->required(),
                        Forms\Components\TextInput::make('courier_phone')->label('Rider phone')->tel(),
                    ])
                    ->action(function (DeliveryRequest $delivery, array $data) {
                        $delivery->update($data + ['status' => 'scheduled']);
                        Notification::make()->success()->title('Rider assigned')->send();
                    }),

                Tables\Actions\Action::make('complete')
                    ->label('Mark delivered')
                    ->icon('heroicon-m-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (DeliveryRequest $d) => ! in_array($d->status, ['delivered', 'cancelled'], true))
                    ->action(function (DeliveryRequest $delivery) {
                        $delivery->update(['status' => 'delivered', 'completed_at' => now()]);
                        Notification::make()->success()->title('Marked delivered')->send();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListDeliveryRequests::route('/'),
            'edit'  => Pages\EditDeliveryRequest::route('/{record}/edit'),
        ];
    }
}
