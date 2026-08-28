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
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Toggle;
use App\Support\Sourcing;
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

            // Prices are shillings. There is no currency to choose.
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

            // ---- where the item actually is -------------------------------
            // The distinction the whole storefront is built around, so it is
            // set here rather than inferred from anything.
            Section::make('Availability & sourcing')
                ->description('Is this in Tanzania now, or is it brought in when ordered?')
                ->columns(2)
                ->columnSpanFull()
                ->schema([
                    Select::make('availability')
                        ->label('Where is it?')
                        ->options([
                            Sourcing::LOCAL  => 'In Tanzania — ready to ship',
                            Sourcing::IMPORT => 'Order from abroad — sourced on demand',
                        ])
                        ->default(Sourcing::LOCAL)
                        ->required()
                        ->live()
                        ->native(false),

                    Select::make('source_country')
                        ->label('Ships from')
                        ->options(collect(Sourcing::COUNTRIES)->map(fn ($c) => $c['flag'] . ' ' . $c['name'])->all())
                        ->default(Sourcing::HOME_COUNTRY)
                        ->searchable()
                        ->native(false),

                    Select::make('shipping_method')
                        ->label('Transit')
                        ->options(collect(Sourcing::SHIPPING_METHODS)->map(fn ($m) => $m['label'])->all())
                        ->native(false)
                        // Only meaningful once something has to travel.
                        ->visible(fn (callable $get) => $get('availability') === Sourcing::IMPORT),

                    TextInput::make('fulfilment_location')
                        ->label('Ships out of')
                        ->placeholder('Dar es Salaam warehouse')
                        ->maxLength(255),

                    TextInput::make('lead_time_min_days')
                        ->label('Delivery from (days)')
                        ->numeric()->minValue(1)->maxValue(180)
                        ->helperText('Leave blank to use the default for this type.'),

                    TextInput::make('lead_time_max_days')
                        ->label('Delivery to (days)')
                        ->numeric()->minValue(1)->maxValue(180),
                ]),

            // ---- the same product, bought a different way -----------------
            Section::make('Alternative buying options')
                ->description('Add the imported version of this product so shoppers can compare price against arrival time.')
                ->collapsed()
                ->columnSpanFull()
                ->schema([
                    Repeater::make('offers')
                        ->relationship()
                        ->label('')
                        ->addActionLabel('Add a buying option')
                        ->columns(3)
                        ->schema([
                            Select::make('availability')
                                ->options([
                                    Sourcing::LOCAL  => 'In Tanzania',
                                    Sourcing::IMPORT => 'From abroad',
                                ])
                                ->default(Sourcing::IMPORT)
                                ->required()
                                ->native(false),

                            Select::make('source_country')
                                ->label('Ships from')
                                ->options(collect(Sourcing::COUNTRIES)->map(fn ($c) => $c['flag'] . ' ' . $c['name'])->all())
                                ->searchable()
                                ->native(false),

                            Select::make('shipping_method')
                                ->label('Transit')
                                ->options(collect(Sourcing::SHIPPING_METHODS)->map(fn ($m) => $m['label'])->all())
                                ->native(false),

                            TextInput::make('price')->numeric()->prefix('TZS')->required(),
                            TextInput::make('was_price')->label('Was')->numeric()->prefix('TZS'),
                            TextInput::make('stock')->numeric()->default(0)
                                ->helperText('Imports are sourced to order — stock is optional.'),

                            TextInput::make('lead_time_min_days')->label('From (days)')->numeric(),
                            TextInput::make('lead_time_max_days')->label('To (days)')->numeric(),
                            Toggle::make('is_active')->label('Live')->default(true),
                        ]),
                ]),

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

                TextColumn::make('availability')
                    ->label('Where')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => $state === Sourcing::IMPORT ? 'From abroad' : 'In Tanzania')
                    ->color(fn (?string $state) => $state === Sourcing::IMPORT ? 'info' : 'success')
                    ->description(fn ($record) => $record->source_country
                        ? (Sourcing::country($record->source_country)['name'] ?? $record->source_country)
                        : null)
                    ->sortable(),

                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime('M d, Y')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('availability')
                    ->label('Availability')
                    ->options([
                        Sourcing::LOCAL  => 'In Tanzania',
                        Sourcing::IMPORT => 'Order from abroad',
                    ]),
                Tables\Filters\SelectFilter::make('source_country')
                    ->label('Ships from')
                    ->options(collect(Sourcing::COUNTRIES)->map(fn ($c) => $c['name'])->all()),
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
