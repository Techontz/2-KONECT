<?php

namespace App\Filament\Widgets;

use App\Models\Vendor;
use Filament\Notifications\Notification;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;
use Illuminate\Database\Eloquent\Builder;

/**
 * Vendors waiting for approval, actionable in place.
 *
 * The marketplace already runs on approval — `vendors.is_approved` gates who
 * can trade — but there was no surface for acting on it. This puts the queue
 * on the dashboard so applications do not sit unseen.
 */
class PendingVendors extends BaseWidget
{
    protected static ?int $sort = 3;
    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->heading('Vendor applications awaiting approval')
            ->query(
                Vendor::query()
                    ->where('is_approved', false)
                    ->withCount('products')
                    ->latest('id')
            )
            ->emptyStateHeading('No applications waiting')
            ->emptyStateDescription('Every vendor on the marketplace has been reviewed.')
            ->columns([
                Tables\Columns\ImageColumn::make('logo')
                    ->label('')
                    ->disk('public')
                    ->circular()
                    // /logo.png does not exist — this fell back to a 404 for every
                    // store without a logo, which is most of them.
                    ->defaultImageUrl(asset('img/store-placeholder.svg')),

                Tables\Columns\TextColumn::make('business_name')
                    ->label('Business')
                    ->searchable()
                    ->weight('bold')
                    ->description(fn (Vendor $vendor) => $vendor->email ?: $vendor->phone),

                Tables\Columns\TextColumn::make('phone')->label('Phone')->toggleable(),

                Tables\Columns\TextColumn::make('products_count')
                    ->label('Products')
                    ->badge()
                    ->color(fn (int $state) => $state > 0 ? 'warning' : 'gray'),

                Tables\Columns\IconColumn::make('nida_document')
                    ->label('ID doc')
                    ->boolean()
                    ->trueIcon('heroicon-o-document-check')
                    ->falseIcon('heroicon-o-document-minus'),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('Applied')
                    ->since()
                    ->sortable(),
            ])
            ->actions([
                Tables\Actions\Action::make('approve')
                    ->icon('heroicon-m-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Approve this vendor?')
                    ->modalDescription('Their products become visible to shoppers immediately.')
                    ->action(function (Vendor $vendor) {
                        $vendor->update(['is_approved' => true]);

                        Notification::make()
                            ->success()
                            ->title($vendor->business_name . ' approved')
                            ->body('They can now sell on the marketplace.')
                            ->send();
                    }),

                Tables\Actions\Action::make('view')
                    ->icon('heroicon-m-eye')
                    ->url(fn (Vendor $vendor) => route('filament.admin.resources.vendors.edit', $vendor))
                    ->openUrlInNewTab(),
            ])
            ->bulkActions([
                Tables\Actions\BulkAction::make('approveSelected')
                    ->label('Approve selected')
                    ->icon('heroicon-m-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->deselectRecordsAfterCompletion()
                    ->action(function ($records) {
                        $records->each->update(['is_approved' => true]);

                        Notification::make()
                            ->success()
                            ->title($records->count() . ' vendors approved')
                            ->send();
                    }),
            ])
            ->paginated([5, 10, 25]);
    }

    /** Hide the widget entirely when the queue is empty. */
    public static function canView(): bool
    {
        return Vendor::where('is_approved', false)->exists();
    }
}
