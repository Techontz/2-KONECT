<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AttributeResource\Pages;
use App\Models\Attribute;
use App\Models\Category;
use Filament\Forms;
use Filament\Tables;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Select;
use Filament\Tables\Columns\TextColumn;
use Filament\Resources\Resource;

class AttributeResource extends Resource
{
    protected static ?string $model = Attribute::class;
    protected static ?string $navigationIcon = 'heroicon-o-adjustments-vertical';
    protected static ?string $navigationGroup = 'Catalogue';
    protected static ?int $navigationSort = 4;
    protected static ?string $navigationLabel = 'Attributes';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form->schema([
            Forms\Components\Section::make('Attribute')
                ->description('Structured product information. This is not the product description — it is the specification a shopper filters and compares on.')
                ->schema([
                    TextInput::make('name')
                        ->required()
                        ->maxLength(255)
                        ->helperText('Shown to sellers on the product form, e.g. Colour, Storage, Condition.'),

                    Select::make('category_id')
                        ->label('Category')
                        ->helperText('Leave empty to offer this attribute on every category.')
                        ->options(Category::query()->orderBy('name')->pluck('name', 'id'))
                        ->searchable()
                        ->nullable(),

                    // The seller product form reads input_type to decide whether
                    // to render a dropdown or a free-text box, so it has to be
                    // configurable here rather than assumed.
                    Select::make('input_type')
                        ->label('Input type')
                        ->options([
                            'select' => 'Choice list — seller picks from the values below',
                            'text' => 'Free text — seller types a value',
                            'number' => 'Number',
                        ])
                        ->default('select')
                        ->required()
                        ->live(),

                    TextInput::make('unit')
                        ->label('Unit')
                        ->placeholder('e.g. GB, ml, kg')
                        ->maxLength(20),

                    Forms\Components\TextInput::make('sort_order')
                        ->label('Order')
                        ->numeric()
                        ->default(0)
                        ->helperText('Lower numbers appear first on the seller form.'),

                    Forms\Components\Toggle::make('is_active')
                        ->label('Available to sellers')
                        ->default(true),
                ])
                ->columns(2),

            Forms\Components\Section::make('Values')
                ->description('The options a seller can choose from.')
                // Only a choice list needs a fixed set of options.
                ->visible(fn (Forms\Get $get) => $get('input_type') === 'select')
                ->schema([
                    Forms\Components\Repeater::make('values')
                        ->relationship()
                        ->label('')
                        ->schema([
                            TextInput::make('value')
                                ->required()
                                ->maxLength(255)
                                ->placeholder('e.g. Black'),

                            TextInput::make('sort_order')
                                ->label('Order')
                                ->numeric()
                                ->default(0),
                        ])
                        ->columns(2)
                        ->orderColumn('sort_order')
                        ->reorderable()
                        ->collapsible()
                        ->itemLabel(fn (array $state): ?string => $state['value'] ?? null)
                        ->addActionLabel('Add a value')
                        ->defaultItems(0),
                ]),
        ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->columns([
                TextColumn::make('name')->searchable()->weight('bold')->sortable(),

                TextColumn::make('input_type')
                    ->label('Type')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'select' => 'Choice list',
                        'number' => 'Number',
                        default => 'Free text',
                    })
                    ->color(fn (?string $state) => $state === 'select' ? 'info' : 'gray'),

                TextColumn::make('values_count')
                    ->counts('values')
                    ->label('Values')
                    ->badge()
                    ->color(fn ($state) => $state > 0 ? 'success' : 'gray'),

                TextColumn::make('category.name')
                    ->label('Category')
                    ->placeholder('All categories')
                    ->sortable(),

                Tables\Columns\IconColumn::make('is_active')
                    ->label('Available')
                    ->boolean(),

                TextColumn::make('created_at')->dateTime('M d, Y')->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('category_id')
                    ->label('Category')
                    ->options(Category::query()->orderBy('name')->pluck('name', 'id')),
                Tables\Filters\TernaryFilter::make('is_active')->label('Available to sellers'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->defaultSort('sort_order');
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListAttributes::route('/'),
            'create' => Pages\CreateAttribute::route('/create'),
            'edit'   => Pages\EditAttribute::route('/{record}/edit'),
        ];
    }
}
