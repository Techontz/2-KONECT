<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductAttributeValueResource\Pages;
use App\Models\ProductAttributeValue;
use App\Models\Product;
use App\Models\Attribute;
use Filament\Forms;
use Filament\Tables;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Tables\Columns\TextColumn;
use Filament\Resources\Resource;

class ProductAttributeValueResource extends Resource
{
    protected static ?string $model = ProductAttributeValue::class;
    protected static ?string $navigationIcon = 'heroicon-o-bars-3-bottom-left';
    protected static ?string $navigationGroup = 'Catalogue';
    protected static ?int $navigationSort = 5;
    protected static ?string $navigationLabel = 'Product Attribute Values';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form->schema([
            Select::make('product_id')
                ->label('Product')
                ->options(Product::all()->pluck('name', 'id'))
                ->searchable()
                ->required(),
            Select::make('attribute_id')
                ->label('Attribute')
                ->options(Attribute::all()->pluck('name', 'id'))
                ->searchable()
                ->required(),
            TextInput::make('value')->required()->maxLength(255),
        ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->columns([
                TextColumn::make('product.name')->label('Product')->searchable(),
                TextColumn::make('attribute.name')->label('Attribute')->searchable(),
                TextColumn::make('value')->label('Value')->searchable(),
                TextColumn::make('created_at')->dateTime('M d, Y')->sortable(),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListProductAttributeValues::route('/'),
            'create' => Pages\CreateProductAttributeValue::route('/create'),
            'edit'   => Pages\EditProductAttributeValue::route('/{record}/edit'),
        ];
    }
}
