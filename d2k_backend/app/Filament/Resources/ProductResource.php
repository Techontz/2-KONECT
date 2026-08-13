<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductResource\Pages;
use App\Models\Product;
use Filament\Forms;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Repeater;
use Filament\Tables;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Resources\Resource;

class ProductResource extends Resource
{
    protected static ?string $model = Product::class;
    protected static ?string $navigationIcon = 'heroicon-o-cube';
    protected static ?string $navigationGroup = 'Catalogue';
    protected static ?int $navigationSort = 1;
    protected static ?string $navigationLabel = 'Products';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form->schema([
            Select::make('category_id')
                ->label('Category')
                ->relationship('category', 'name')
                ->searchable()
                ->required(),

            TextInput::make('name')
                ->required()
                ->maxLength(255)
                ->label('Product Name'),

            Textarea::make('description')
                ->rows(4)
                ->maxLength(1000)
                ->label('Description')
                ->columnSpanFull(),

            TextInput::make('old_price')
                ->numeric()
                ->minValue(0)
                ->maxLength(10)
                ->label('Old Price'),

            TextInput::make('new_price')
                ->required()
                ->numeric()
                ->minValue(0)
                ->maxLength(10)
                ->label('New Price'),

            TextInput::make('stock')
                ->integer()
                ->minValue(0)
                ->default(0)
                ->label('Stock'),

            FileUpload::make('image')
                ->image()
                ->directory('products')
                ->maxSize(2048)
                ->label('Main Product Image')
                ->columnSpanFull(),

            Repeater::make('images')
                ->relationship()
                ->schema([
                    FileUpload::make('image')
                        ->image()
                        ->directory('products/gallery')
                        ->maxSize(2048)
                        ->label('Gallery Image'),
                ])
                ->label('Product Gallery')
                ->columnSpanFull(),
        ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->columns([
                // Every product's photo lives in the gallery relation — the
                // legacy `image` column is null on all of them, so the old
                // "Main Image" column was permanently blank and only took
                // space, which is most costly on a phone.
                ImageColumn::make('images.0.image')
                    ->label('Photo')
                    ->width(56)
                    ->height(56)
                    ->square()
                    ->defaultImageUrl(asset('img/store-placeholder.svg')),

                TextColumn::make('name')
                    ->label('Product Name')
                    ->searchable(),

                TextColumn::make('category.name')
                    ->label('Category')
                    ->sortable(),

                TextColumn::make('new_price')
                    ->label('New Price')
                    ->prefix('TSh ')
                    ->sortable(),

                TextColumn::make('old_price')
                    ->label('Old Price')
                    ->prefix('TSh ')
                    ->sortable(),

                TextColumn::make('stock')
                    ->label('Stock')
                    ->sortable(),

                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime('M d, Y')
                    ->sortable(),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListProducts::route('/'),
            'create' => Pages\CreateProduct::route('/create'),
            'edit'   => Pages\EditProduct::route('/{record}/edit'),
        ];
    }
}
