<?php

namespace App\Filament\Widgets;

use App\Models\Product;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

/**
 * Inventory that needs attention: everything at five units or fewer, plus
 * anything already sold out. Sorted so the emptiest shelves surface first.
 */
class LowStockProducts extends BaseWidget
{
    protected static ?int $sort = 4;
    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->heading('Inventory needing attention')
            ->description('Products at or below five units, sold-out items first.')
            ->query(
                Product::query()
                    ->with(['vendor', 'category'])
                    ->where('stock', '<=', 5)
                    ->orderBy('stock')
                    ->orderByDesc('id')
            )
            ->emptyStateHeading('Stock levels are healthy')
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('Product')
                    ->searchable()
                    ->limit(48)
                    ->weight('medium')
                    ->description(fn (Product $product) => $product->category?->name),

                Tables\Columns\TextColumn::make('vendor.business_name')
                    ->label('Vendor')
                    ->searchable()
                    ->toggleable(),

                Tables\Columns\TextColumn::make('stock')
                    ->label('Stock')
                    ->badge()
                    ->color(fn (int $state) => $state <= 0 ? 'danger' : ($state <= 2 ? 'warning' : 'gray'))
                    ->formatStateUsing(fn (int $state) => $state <= 0 ? 'Sold out' : $state . ' left')
                    ->sortable(),

                Tables\Columns\TextColumn::make('new_price')
                    ->label('Price')
                    ->money('TZS')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\Filter::make('sold_out')
                    ->label('Sold out only')
                    ->query(fn ($query) => $query->where('stock', '<=', 0)),
            ])
            ->actions([
                Tables\Actions\Action::make('edit')
                    ->icon('heroicon-m-pencil-square')
                    ->url(fn (Product $product) => route('filament.admin.resources.products.edit', $product)),
            ])
            ->paginated([5, 10, 25, 50])
            ->defaultPaginationPageOption(5);
    }
}
