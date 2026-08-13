<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CategoryResource\Pages;
use App\Models\Category;
use Filament\Forms;
use Filament\Tables;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\FileUpload;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Resources\Resource;

class CategoryResource extends Resource
{
    protected static ?string $model = Category::class;
    protected static ?string $navigationIcon = 'heroicon-o-tag';
    protected static ?string $navigationGroup = 'Catalogue';
    protected static ?int $navigationSort = 2;
    protected static ?string $navigationLabel = 'Categories';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form->schema([
            TextInput::make('name')
                ->required()
                ->maxLength(255),
            TextInput::make('icon')
                ->label('Icon (Emoji or Class)')
                ->maxLength(10)
                ->helperText('Enter an emoji or icon name (optional if using an image)'),
            FileUpload::make('icon_image')
                ->label('Icon Image')
                ->disk('public') // THIS IS THE KEY LINE!
                ->directory('categories')
                ->image()
                ->imageCropAspectRatio('1:1')
                ->maxSize(1024)
                ->helperText('Upload an image icon (optional if using emoji/icon class)'),
        ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->sortable(),
                TextColumn::make('name')->searchable(),
                TextColumn::make('icon')
                    ->label('Emoji/Icon'),
                ImageColumn::make('icon_image')
                    ->label('Icon Image')
                    ->disk('public')
                    ->circular(),
                TextColumn::make('created_at')->dateTime('M d, Y')->sortable(),
            ])
            ->defaultSort('id', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListCategories::route('/'),
            'create' => Pages\CreateCategory::route('/create'),
            'edit'   => Pages\EditCategory::route('/{record}/edit'),
        ];
    }
}
