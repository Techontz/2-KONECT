<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SubcategoryResource\Pages;
use App\Models\Subcategory;
use Filament\Forms;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\FileUpload;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ImageColumn;

class SubcategoryResource extends Resource
{
    protected static ?string $model = Subcategory::class;
    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';
    protected static ?string $navigationGroup = 'Catalogue';
    protected static ?int $navigationSort = 3;
    protected static ?string $navigationLabel = 'Subcategories';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form->schema([
            Select::make('category_id')
                ->label('Category')
                ->relationship('category', 'name')
                ->preload()
                ->required()
                ->searchable(),

            TextInput::make('name')
                ->label('Subcategory Name')
                ->required()
                ->maxLength(255),

            TextInput::make('icon')
                ->label('Icon (emoji, optional)')
                ->maxLength(10)
                ->placeholder('e.g. 🥾'),

            FileUpload::make('icon_image')
                ->label('Icon Image (optional, PNG/JPG/SVG)')
                ->image()
                ->imageEditor() // allows cropping, rotate, zoom
                ->imageCropAspectRatio('1:1') // enforce square
                ->directory('subcategory-icons')
                ->maxSize(512) // 512 KB
                ->helperText('Upload a square PNG, JPG, or SVG. Will display as 48x48px in table.')
                ->preserveFilenames()
                ->columnSpanFull(),
        ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->label('ID')
                    ->sortable(),

                TextColumn::make('name')
                    ->label('Subcategory')
                    ->searchable(),

                TextColumn::make('category.name')
                    ->label('Category')
                    ->sortable()
                    ->toggleable(),

                TextColumn::make('icon')
                    ->label('Icon (Emoji)'),

                ImageColumn::make('icon_image')
                    ->label('Icon Image')
                    ->width(48)
                    ->height(48)
                    ->circular(),

                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime('M d, Y')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListSubcategories::route('/'),
            'create' => Pages\CreateSubcategory::route('/create'),
            'edit'   => Pages\EditSubcategory::route('/{record}/edit'),
        ];
    }
}
