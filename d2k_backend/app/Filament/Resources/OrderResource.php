<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderResource\Pages;
use App\Models\Order;
use App\Models\Product;
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
                        ->options([
                            'pending'    => 'Pending',
                            'processing' => 'Processing',
                            'shipped'    => 'Shipped',
                            'completed'  => 'Completed',
                            'cancelled'  => 'Cancelled',
                        ])
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
                    ->color(fn (string $state) => match ($state) {
                        'completed'  => 'success',
                        'shipped', 'processing' => 'info',
                        'pending'    => 'warning',
                        'cancelled'  => 'danger',
                        default      => 'gray',
                    })
                    ->sortable(),

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
                Tables\Filters\SelectFilter::make('status')->options([
                    'pending'    => 'Pending',
                    'processing' => 'Processing',
                    'shipped'    => 'Shipped',
                    'completed'  => 'Completed',
                    'cancelled'  => 'Cancelled',
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
                    ->visible(fn (Order $order) => in_array($order->status, ['pending', 'processing', 'shipped'], true))
                    ->requiresConfirmation()
                    ->action(function (Order $order) {
                        $next = match ($order->status) {
                            'pending'    => 'processing',
                            'processing' => 'shipped',
                            'shipped'    => 'completed',
                            default      => $order->status,
                        };

                        $order->update(['status' => $next]);

                        Notification::make()->success()
                            ->title("Order {$order->reference} is now {$next}")
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
                            Product::where('id', $order->product_id)->increment('stock', $order->quantity);
                            $order->update(['status' => 'cancelled']);
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

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrders::route('/'),
            'edit'  => Pages\EditOrder::route('/{record}/edit'),
        ];
    }
}
