<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentResource\Pages;
use App\Models\Payment;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * The payment ledger: every attempt to pay, and what became of it.
 *
 * Entirely read-only, and that is the point. A payment is a record of what a
 * gateway did; editing one here would be writing down something that did not
 * happen. Settlement is decided by a signed webhook and reflected on the
 * order — this is the evidence behind that decision, not a lever.
 *
 * It is also where a declined attempt is visible. `orders.payment_status`
 * holds one state, so a card that failed before a later one succeeded leaves
 * no trace there; it leaves a row here, which is exactly what is wanted when a
 * customer says they were charged twice.
 */
class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;

    protected static ?string $navigationIcon = 'heroicon-o-credit-card';
    protected static ?string $navigationGroup = 'Orders & customers';
    protected static ?int $navigationSort = 2;
    protected static ?string $recordTitleAttribute = 'reference';
    protected static ?string $navigationLabel = 'Payments';

    /** Nothing may be created, edited or deleted by hand. */
    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('reference')
                    ->label('Order')
                    ->searchable()
                    ->copyable()
                    ->weight('bold')
                    ->description(fn (Payment $payment) => $payment->created_at?->diffForHumans()),

                Tables\Columns\TextColumn::make('provider')
                    ->badge()
                    ->color('gray'),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state) => match ($state) {
                        Payment::PAID     => 'success',
                        Payment::PENDING  => 'warning',
                        Payment::REFUNDED => 'info',
                        Payment::DISPUTED => 'danger',
                        default           => 'gray',
                    }),

                // Rendered from the stored minor unit through the same helper
                // that produced it, never by dividing by 100 here.
                Tables\Columns\TextColumn::make('amount_minor')
                    ->label('Amount')
                    ->formatStateUsing(fn (Payment $payment) => $payment->currency . ' ' . number_format($payment->amount(), 2)),

                Tables\Columns\TextColumn::make('refunded_amount_minor')
                    ->label('Refunded')
                    ->formatStateUsing(fn (Payment $payment) => (int) $payment->refunded_amount_minor === 0
                        ? '—'
                        : $payment->currency . ' ' . number_format($payment->refundedAmount(), 2)),

                Tables\Columns\TextColumn::make('user.name')
                    ->label('Customer')
                    ->searchable()
                    ->placeholder('—'),

                Tables\Columns\TextColumn::make('stripe_payment_intent_id')
                    ->label('Stripe ref')
                    ->copyable()
                    ->limit(20)
                    ->placeholder('—')
                    ->toggleable(isToggledHiddenByDefault: true),

                Tables\Columns\TextColumn::make('paid_at')
                    ->label('Paid')
                    ->dateTime('d M Y H:i')
                    ->placeholder('—')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        Payment::PENDING  => 'Pending',
                        Payment::PAID     => 'Paid',
                        Payment::FAILED   => 'Failed',
                        Payment::EXPIRED  => 'Expired',
                        Payment::REFUNDED => 'Refunded',
                        Payment::DISPUTED => 'Disputed',
                    ]),

                Tables\Filters\SelectFilter::make('provider')
                    ->options([Payment::STRIPE => 'Stripe']),
            ])
            ->actions([])
            ->bulkActions([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPayments::route('/'),
        ];
    }
}
