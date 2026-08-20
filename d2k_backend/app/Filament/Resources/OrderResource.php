<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderResource\Pages;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Support\OrderJourney;
use App\Support\Sourcing;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\DB;

/**
 * Order management.
 *
 * The `orders` table holds one row per product line; a checkout is identified
 * by the shared `reference`. This resource works at line level (that is what
 * a vendor fulfils) while surfacing the reference so an admin can see the
 * whole basket.
 */
class OrderResource extends Resource
{
    protected static ?string $model = Order::class;
    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';
    protected static ?string $navigationGroup = 'Orders & customers';
    protected static ?int $navigationSort = 1;
    protected static ?string $recordTitleAttribute = 'reference';

    /** Badge the sidebar with work that is actually waiting. */
    public static function getNavigationBadge(): ?string
    {
        $pending = static::getModel()::where('status', 'pending')->count();

        return $pending > 0 ? (string) $pending : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Order')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('reference')
                        ->label('Reference')
                        ->disabled()
                        ->dehydrated(false),

                    Forms\Components\Select::make('status')
                        // Every stop on the journey, so an imported order can
                        // be moved through customs and the warehouse rather
                        // than jumping from "processing" to "shipped".
                        ->options(collect(OrderJourney::all())
                            ->mapWithKeys(fn ($s) => [$s => OrderJourney::label($s)])
                            ->all())
                        ->required()
                        ->native(false),

                    Forms\Components\Select::make('user_id')
                        ->relationship('buyer', 'name')
                        ->label('Customer')
                        ->searchable()
                        ->disabled()
                        ->dehydrated(false),

                    Forms\Components\Select::make('vendor_id')
                        ->relationship('vendor', 'business_name')
                        ->label('Vendor')
                        ->searchable()
                        ->disabled()
                        ->dehydrated(false),
                ]),

            Forms\Components\Section::make('Line')
                ->columns(3)
                ->schema([
                    Forms\Components\Select::make('product_id')
                        ->relationship('product', 'name')
                        ->searchable()
                        ->disabled()
                        ->dehydrated(false),

                    Forms\Components\TextInput::make('quantity')->numeric()->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('total')->prefix('TZS')->disabled()->dehydrated(false),
                ]),

            Forms\Components\Section::make('Shipping & tracking')
                ->description('What the buyer sees on their tracking screen.')
                ->columns(3)
                ->schema([
                    Forms\Components\Select::make('fulfilment_type')
                        ->label('Type')
                        ->options([
                            Sourcing::LOCAL  => 'Local delivery',
                            Sourcing::IMPORT => 'International order',
                        ])
                        ->native(false),

                    Forms\Components\Select::make('source_country')
                        ->label('From')
                        ->options(collect(Sourcing::COUNTRIES)->map(fn ($c) => $c['flag'] . ' ' . $c['name'])->all())
                        ->searchable()
                        ->native(false),

                    Forms\Components\Select::make('shipping_method')
                        ->label('Transit')
                        ->options(collect(Sourcing::SHIPPING_METHODS)->map(fn ($m) => $m['label'])->all())
                        ->native(false),

                    Forms\Components\TextInput::make('carrier')->maxLength(80),
                    Forms\Components\TextInput::make('tracking_number')->label('Tracking number')->maxLength(80),
                    Forms\Components\DatePicker::make('estimated_arrival_at')->label('Estimated arrival'),
                ]),

            Forms\Components\Section::make('Delivery')
                ->columns(2)
                ->schema([
                    Forms\Components\Textarea::make('delivery_address')->rows(2)->columnSpanFull(),
                    Forms\Components\TextInput::make('customer_phone')->label('Phone'),
                    Forms\Components\TextInput::make('payment_method')->disabled()->dehydrated(false),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('reference')
                    ->label('Reference')
                    ->searchable()
                    ->copyable()
                    ->weight('bold')
                    ->description(fn (Order $order) => $order->created_at?->diffForHumans()),

                Tables\Columns\TextColumn::make('buyer.name')
                    ->label('Customer')
                    ->searchable()
                    ->description(fn (Order $order) => $order->customer_phone),

                Tables\Columns\TextColumn::make('product.name')
                    ->label('Product')
                    ->limit(32)
                    ->searchable(),

                Tables\Columns\TextColumn::make('vendor.business_name')
                    ->label('Vendor')
                    ->searchable()
                    ->toggleable(),

                Tables\Columns\TextColumn::make('quantity')->label('Qty')->alignCenter(),

                Tables\Columns\TextColumn::make('total')
                    ->money('TZS')
                    ->sortable()
                    ->summarize(Tables\Columns\Summarizers\Sum::make()->money('TZS')),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => OrderJourney::label($state))
                    ->color(fn (string $state) => match ($state) {
                        'completed' => 'success',
                        'cancelled', 'refunded' => 'danger',
                        'pending'   => 'warning',
                        default     => 'info',
                    })
                    ->sortable(),

                Tables\Columns\TextColumn::make('fulfilment_type')
                    ->label('Type')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => $state === Sourcing::IMPORT ? '🌍 Import' : '🇹🇿 Local')
                    ->color(fn (?string $state) => $state === Sourcing::IMPORT ? 'info' : 'success')
                    ->toggleable(),

                Tables\Columns\TextColumn::make('payment_method')
                    ->label('Payment')
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'cash_on_delivery' => 'Cash on delivery',
                        'mobile_money'     => 'Mobile money',
                        default            => $state ?: '—',
                    })
                    ->toggleable(),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Placed')
                    ->dateTime('j M Y, H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->options(
                    collect(OrderJourney::all())->mapWithKeys(fn ($s) => [$s => OrderJourney::label($s)])->all()
                ),
                Tables\Filters\SelectFilter::make('fulfilment_type')
                    ->label('Type')
                    ->options([
                        Sourcing::LOCAL  => 'Local delivery',
                        Sourcing::IMPORT => 'International order',
                    ]),
                Tables\Filters\SelectFilter::make('vendor')
                    ->relationship('vendor', 'business_name')
                    ->searchable()
                    ->preload(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),

                Tables\Actions\Action::make('advance')
                    ->label('Mark next stage')
                    ->icon('heroicon-m-arrow-right-circle')
                    ->color('success')
                    ->visible(fn (Order $order) => static::nextStage($order) !== null)
                    ->requiresConfirmation()
                    ->modalDescription(fn (Order $order) => 'Moves to: ' . OrderJourney::label(static::nextStage($order) ?? ''))
                    ->action(function (Order $order) {
                        $next = static::nextStage($order);

                        if ($next === null) {
                            return;
                        }

                        $order->update(['status' => $next]);

                        // The buyer's timeline is read from recorded events,
                        // so moving an order has to leave a trace.
                        OrderEvent::create([
                            'reference'   => $order->reference,
                            'order_id'    => $order->id,
                            'status'      => $next,
                            'title'       => OrderJourney::label($next),
                            'note'        => OrderJourney::note($next),
                            'happened_at' => now(),
                        ]);

                        Notification::make()->success()
                            ->title("Order {$order->reference}: " . OrderJourney::label($next))
                            ->send();
                    }),

                Tables\Actions\Action::make('cancel')
                    ->icon('heroicon-m-x-circle')
                    ->color('danger')
                    ->visible(fn (Order $order) => ! in_array($order->status, ['cancelled', 'completed'], true))
                    ->requiresConfirmation()
                    ->modalHeading('Cancel this order line?')
                    ->modalDescription('The reserved stock is returned to the product.')
                    ->action(function (Order $order) {
                        DB::transaction(function () use ($order) {
                            // Cancelling must give the units back, or stock
                            // leaks away every time an order falls through.
                            // An import never held local units to return.
                            if ($order->fulfilment_type !== Sourcing::IMPORT) {
                                $order->offer_id
                                    ? ProductOffer::where('id', $order->offer_id)->increment('stock', $order->quantity)
                                    : Product::where('id', $order->product_id)->increment('stock', $order->quantity);
                            }

                            $order->update(['status' => 'cancelled']);

                            OrderEvent::create([
                                'reference'   => $order->reference,
                                'order_id'    => $order->id,
                                'status'      => OrderJourney::CANCELLED,
                                'title'       => OrderJourney::label(OrderJourney::CANCELLED),
                                'happened_at' => now(),
                            ]);
                        });

                        Notification::make()->success()
                            ->title('Order cancelled and stock restored')
                            ->send();
                    }),
            ])
            ->bulkActions([
                Tables\Actions\BulkAction::make('markCompleted')
                    ->label('Mark completed')
                    ->icon('heroicon-m-check-badge')
                    ->color('success')
                    ->requiresConfirmation()
                    ->deselectRecordsAfterCompletion()
                    ->action(fn ($records) => $records->each->update(['status' => 'completed'])),
            ]);
    }

    /**
     * The next stop on this order's own route.
     *
     * A local delivery skips the import stops entirely, so "next" is read off
     * the right path rather than hard-coded.
     */
    private static function nextStage(Order $order): ?string
    {
        if (! OrderJourney::isOpen($order->status)) {
            return null;
        }

        $path  = OrderJourney::path($order->fulfilment_type ?? Sourcing::LOCAL);
        $index = array_search($order->status, $path, true);

        if ($index === false) {
            return null;
        }

        return $path[$index + 1] ?? null;
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrders::route('/'),
            'edit'  => Pages\EditOrder::route('/{record}/edit'),
        ];
    }
}
