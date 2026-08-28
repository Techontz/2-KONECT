<?php

namespace App\Filament\Resources;

use App\Filament\Resources\OrderResource\Pages;
use App\Models\CheckoutPaymentChannel;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Support\OrderGate;
use App\Support\OrderJourney;
use App\Support\Sourcing;
use App\Support\StockReservation;
use Filament\Forms;
use Filament\Forms\Form;
use App\Models\DeliveryRequest;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;
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
                        //
                        // Narrowed to the closing states on an unpaid import.
                        // The model refuses a forward save regardless, but
                        // being told why here beats being told after filling
                        // the form in.
                        ->options(function (?Order $record) {
                            $all = collect(OrderJourney::all())
                                ->mapWithKeys(fn ($s) => [$s => OrderJourney::label($s)]);

                            if ($record && OrderGate::awaitsPrepayment($record)) {
                                return $all->only(['pending', 'cancelled', 'refunded'])->all();
                            }

                            return $all->all();
                        })
                        ->helperText(fn (?Order $record) => $record && OrderGate::awaitsPrepayment($record)
                            ? '⚠ ' . OrderGate::MESSAGE
                            : null)
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
                ]),

            // Read-only on purpose. A payment is confirmed with the Verify
            // action, which records who did it and when; a form field would
            // let it be set silently and by anyone with edit rights.
            Forms\Components\Section::make('Payment')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('payment_method')->label('Method')->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('payment_status')->label('Status')->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('payment_reference')
                        ->label('Customer reference')
                        ->helperText('What the customer typed after paying. Check it against the mobile-money statement before verifying.')
                        ->disabled()->dehydrated(false),
                    Forms\Components\DateTimePicker::make('payment_verified_at')->label('Verified at')->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('payment_note')->label('Note')->disabled()->dehydrated(false)->columnSpanFull(),
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

                Tables\Columns\TextColumn::make('payment_status')
                    ->label('Paid?')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'not_required'          => 'On delivery',
                        'awaiting_payment'      => 'Awaiting payment',
                        'awaiting_verification' => 'Check payment',
                        'verified'              => 'Verified',
                        'rejected'              => 'Rejected',
                        default                 => $state ?: '—',
                    })
                    ->color(fn (?string $state) => match ($state) {
                        'verified'              => 'success',
                        'awaiting_verification' => 'warning',
                        'rejected'              => 'danger',
                        default                 => 'gray',
                    })
                    ->toggleable(),

                // The one line an administrator must not have to work out for
                // themselves. An unpaid import looks exactly like a paid one
                // in every other column, and the cost of confusing them is
                // goods bought abroad against money that never arrives.
                Tables\Columns\TextColumn::make('fulfilment_type')
                    ->label('Process?')
                    ->badge()
                    ->state(fn (Order $order) => match (true) {
                        OrderGate::awaitsPrepayment($order) => 'PAYMENT REQUIRED — DO NOT PROCESS',
                        OrderGate::isImport($order)         => 'Payment verified — ready',
                        default                             => OrderGate::paymentBadge($order)['label'],
                    })
                    ->color(fn (Order $order) => match (true) {
                        OrderGate::awaitsPrepayment($order) => 'danger',
                        OrderGate::isImport($order)         => 'success',
                        default                             => 'gray',
                    })
                    ->icon(fn (Order $order) => OrderGate::awaitsPrepayment($order)
                        ? 'heroicon-m-exclamation-triangle'
                        : null),

                // Where the goods come from, said once rather than inferred
                // from a lead time or opened out of the product.
                Tables\Columns\TextColumn::make('source_country')
                    ->label('Origin')
                    ->badge()
                    ->state(fn (Order $order) => OrderGate::originBadge($order)['flag'] . ' ' . OrderGate::originBadge($order)['label'])
                    ->color(fn (Order $order) => OrderGate::isImport($order) ? 'warning' : 'info')
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
                Tables\Filters\SelectFilter::make('payment_status')
                    ->label('Payment')
                    ->options([
                        'awaiting_verification' => 'Waiting to be checked',
                        'awaiting_payment'      => 'Awaiting payment',
                        'verified'              => 'Verified',
                        'rejected'              => 'Rejected',
                        'not_required'          => 'Cash on delivery',
                    ]),
                Tables\Filters\SelectFilter::make('vendor')
                    ->relationship('vendor', 'business_name')
                    ->searchable()
                    ->preload(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),

                // ---- confirming money actually arrived ----
                //
                // The customer typing a reference moves the order into this
                // queue and no further. Somebody checks it against the
                // statement and presses this, and only then is the order paid.
                Tables\Actions\Action::make('verifyPayment')
                    ->label('Verify payment')
                    ->icon('heroicon-m-check-badge')
                    ->color('success')
                    // Never offered for a gateway-settled order. A card payment
                    // is confirmed by a signed webhook from the processor; a
                    // person pressing "verified" on one would be attesting to a
                    // bank statement they have not seen, and would overwrite a
                    // machine-checked fact with a human guess.
                    ->visible(fn (Order $order) => $order->payment_status === 'awaiting_verification'
                        && ! static::isGatewayPaid($order))
                    ->requiresConfirmation()
                    ->modalHeading('Confirm this payment arrived')
                    ->modalDescription(fn (Order $order) => 'Reference given: ' . ($order->payment_reference ?: '—')
                        . ' · Amount: TZS ' . number_format((float) $order->total))
                    ->form([
                        Forms\Components\TextInput::make('note')->label('Note (optional)')->maxLength(255),
                    ])
                    ->action(function (Order $order, array $data) {
                        static::settlePayment($order, 'verified', $data['note'] ?? null);

                        Notification::make()->title('Payment verified')->success()->send();
                    }),

                Tables\Actions\Action::make('rejectPayment')
                    ->label('Reject payment')
                    ->icon('heroicon-m-x-circle')
                    ->color('danger')
                    ->visible(fn (Order $order) => $order->payment_status === 'awaiting_verification'
                        && ! static::isGatewayPaid($order))
                    ->form([
                        Forms\Components\TextInput::make('note')
                            ->label('Why?')
                            ->helperText('The customer sees this, so say what to do next.')
                            ->required()
                            ->maxLength(255),
                    ])
                    ->action(function (Order $order, array $data) {
                        static::settlePayment($order, 'rejected', $data['note']);

                        Notification::make()->title('Payment rejected')->danger()->send();
                    }),

                // ---- delivery, added separately and never automatically ----
                //
                // Nothing charges an imported order for delivery at checkout,
                // because when it is bought nobody knows what moving it the
                // last mile will cost. This is where that is decided, once the
                // shipment is actually here.
                Tables\Actions\Action::make('addDelivery')
                    ->label('Add delivery')
                    ->icon('heroicon-m-truck')
                    ->color('info')
                    ->visible(fn (Order $order) => (float) $order->delivery_fee <= 0)
                    ->modalHeading('Add delivery to this order')
                    ->form([
                        Forms\Components\Select::make('mode')
                            ->label('Delivery method')
                            ->options([
                                'delivery' => 'Delivery to the customer',
                                'pickup'   => 'Customer collects',
                            ])
                            ->default('delivery')
                            ->required()
                            ->live(),

                        Forms\Components\TextInput::make('fee')
                            ->label('Delivery fee (TZS)')
                            ->numeric()
                            ->minValue(0)
                            ->default(0)
                            ->required()
                            ->helperText('0 for a free delivery or a collection.'),

                        Forms\Components\Textarea::make('notes')
                            ->label('Notes for the customer')
                            ->rows(2)
                            ->maxLength(500),
                    ])
                    ->action(function (Order $order, array $data) {
                        static::attachDelivery($order, $data);

                        Notification::make()->title('Delivery added')->success()->send();
                    }),

                Tables\Actions\Action::make('advance')
                    ->label('Mark next stage')
                    ->icon('heroicon-m-arrow-right-circle')
                    ->color('success')
                    ->visible(fn (Order $order) => static::nextStage($order) !== null && OrderGate::processable($order))
                    ->requiresConfirmation()
                    ->modalDescription(fn (Order $order) => 'Moves to: ' . OrderJourney::label(static::nextStage($order) ?? ''))
                    ->action(function (Order $order) {
                        // Enforced here as well as hidden below, because a
                        // hidden button is a suggestion. Filament actions are
                        // reachable by anyone who can reach the panel, and the
                        // rule this protects is the one that spends money on a
                        // supplier abroad.
                        if ($refusal = OrderGate::refusal($order)) {
                            Notification::make()
                                ->title('Payment required')
                                ->body($refusal)
                                ->danger()
                                ->send();

                            return;
                        }

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
                    ->modalDescription('The reserved stock is returned to whichever product, option or offer it came from.')
                    ->action(function (Order $order) {
                        DB::transaction(function () use ($order) {
                            // Cancelling must give the units back, or stock
                            // leaks away every time an order falls through —
                            // and it must give them back to the row that
                            // actually held them. This asked only whether the
                            // line was an import, so cancelling a variant here
                            // credited the parent product, which had never been
                            // decremented, while the variant stayed short.
                            //
                            // The rule is stated once in StockReservation,
                            // including the case that makes it subtle: a
                            // variant restores even for an import, because a
                            // variant reserves stock where an imported product
                            // does not.
                            StockReservation::restore($order);

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
                    ->action(function ($records) {
                        // Partitioned rather than refused wholesale: an admin
                        // sweeping fifty orders should not be stopped by one
                        // unpaid import, but must be told which were skipped
                        // rather than left to assume all fifty moved.
                        $blocked = $records->filter(fn (Order $order) => ! OrderGate::processable($order));

                        $records->reject(fn (Order $order) => ! OrderGate::processable($order))
                            ->each->update(['status' => 'completed']);

                        if ($blocked->isNotEmpty()) {
                            Notification::make()
                                ->title($blocked->count() . ' order(s) skipped')
                                ->body(OrderGate::MESSAGE . ' Skipped: ' . $blocked->pluck('reference')->unique()->join(', '))
                                ->warning()
                                ->persistent()
                                ->send();
                        }
                    }),
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
    /**
     * Record the outcome of a manual payment check across the whole checkout.
     *
     * Every line of one checkout shares a reference and a single payment, so
     * they settle together — a part-verified order would be a fiction.
     *
     * Scoped to the buyer as well as the reference. `orders.reference` is
     * indexed but not unique, and the legacy checkout used to accept the
     * reference from the request body, so a group could contain rows belonging
     * to more than one customer. Verifying one payment would then have settled
     * every order in that group, for everybody in it. Settling by
     * (reference, buyer) means the blast radius of a poisoned group is one
     * account's own orders, which is the most a settlement should ever reach.
     */
    /**
     * Is this order paid through a gateway that confirms itself?
     *
     * Read from the channel row rather than from the code string, so a second
     * gateway added later needs no change here — the same reason the clients
     * branch on `is_gateway` instead of on `code === 'stripe'`.
     */
    protected static function isGatewayPaid(Order $order): bool
    {
        return CheckoutPaymentChannel::where('code', $order->payment_method)
            ->value('is_gateway') === true;
    }

    protected static function settlePayment(Order $order, string $status, ?string $note): void
    {
        DB::transaction(function () use ($order, $status, $note) {
            Order::where('reference', $order->reference)
                ->where('user_id', $order->user_id)
                ->update([
                    'payment_status'      => $status,
                    'payment_note'        => $note,
                    'payment_verified_at' => $status === 'verified' ? now() : null,
                    'payment_verified_by' => auth()->id(),
                ]);

            OrderEvent::create([
                'reference'   => $order->reference,
                'order_id'    => $order->id,
                'status'      => $order->status,
                'title'       => $status === 'verified' ? 'Payment verified' : 'Payment rejected',
                'note'        => $note ?: ($status === 'verified'
                    ? 'We have received your payment.'
                    : 'We could not confirm your payment.'),
                'happened_at' => now(),
            ]);
        });
    }

    /**
     * Attach a delivery to an order that has arrived.
     *
     * Reuses the delivery_requests table the storefront already reads, rather
     * than inventing a second place a delivery can live. The fee is mirrored
     * onto the order because that is where the customer's total is read from.
     */
    protected static function attachDelivery(Order $order, array $data): void
    {
        DB::transaction(function () use ($order, $data) {
            $fee = (float) ($data['fee'] ?? 0);

            DeliveryRequest::updateOrCreate(
                ['order_reference' => $order->reference],
                [
                    'reference'       => 'DR-' . strtoupper(Str::random(8)),
                    'user_id'         => $order->user_id,
                    'mode'            => $data['mode'],
                    // The buyer is the recipient unless somebody says
                    // otherwise; the column is required and the order already
                    // knows who placed it.
                    'recipient_name'  => $order->buyer?->name ?? 'Customer',
                    'recipient_phone' => $order->customer_phone,
                    'address'         => $order->delivery_address,
                    'notes'           => $data['notes'] ?? null,
                    'fee'             => $fee,
                    'status'          => 'requested',
                ],
            );

            // The fee belongs to the checkout, not to each line. Scoped to the
            // buyer for the same reason settlePayment() is: a reference is not
            // guaranteed unique across accounts, and a delivery fee must never
            // land on somebody else's order.
            Order::where('reference', $order->reference)
                ->where('user_id', $order->user_id)
                ->orderBy('id')
                ->limit(1)
                ->update(['delivery_fee' => $fee]);

            OrderEvent::create([
                'reference'   => $order->reference,
                'order_id'    => $order->id,
                'status'      => $order->status,
                'title'       => 'Delivery added',
                'note'        => $fee > 0
                    ? 'Delivery arranged. Fee: TZS ' . number_format($fee)
                    : 'Delivery arranged.',
                'happened_at' => now(),
            ]);
        });
    }

}
