<?php

namespace App\Filament\Resources;

use App\Filament\Resources\BannerResource\Pages;
use App\Models\Banner;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Resources\Resource;

class BannerResource extends Resource
{
    protected static ?string $model = Banner::class;
    protected static ?string $navigationIcon = 'heroicon-o-photo';
    protected static ?string $navigationGroup = 'Storefront';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Placement')
                    ->description('Where this banner appears on the homepage.')
                    ->schema([
                        Forms\Components\Select::make('placement')
                            ->label('Position')
                            ->options([
                                'hero'      => 'Hero carousel (wide, rotates)',
                                'hero_side' => 'Hero side card (fixed, beside the carousel)',
                                'promo'     => 'Promotional strip (between product rows)',
                                'archive'   => 'Archived (not shown)',
                            ])
                            ->default('hero')
                            ->required()
                            ->native(false),

                        Forms\Components\TextInput::make('sort_order')
                            ->label('Order')
                            ->helperText('Lower numbers appear first.')
                            ->numeric()
                            ->default(0),
                    ])->columns(2),

                Forms\Components\Section::make('Content')
                    ->schema([
                        Forms\Components\TextInput::make('title')
                            ->label('Title')
                            ->maxLength(255),

                        Forms\Components\TextInput::make('subtitle')
                            ->label('Subtitle')
                            ->maxLength(255),

                        Forms\Components\TextInput::make('cta_label')
                            ->label('Button label')
                            ->placeholder('Shop now')
                            ->maxLength(60),

                        Forms\Components\TextInput::make('link')
                            ->label('Links to')
                            ->helperText('A storefront path such as /deals or /category?id=9, or a full URL.')
                            ->maxLength(255),

                        Forms\Components\TextInput::make('alt')
                            ->label('Image description (for screen readers)')
                            ->maxLength(255),
                    ])->columns(2),

                /*
                 * Artwork is bounded on the way in.
                 *
                 * A banner uploaded straight from a design tool arrived as a
                 * 5.7 MB PNG, and the API host serves banner files at roughly
                 * 140 KB/s — forty seconds for one slide. The homepage carousel
                 * moves on every six, so a newly published banner was never on
                 * screen long enough to be seen and looked to an administrator
                 * as though it had not published at all.
                 *
                 * Resizing in the browser before upload fixes it at the source:
                 * 1600px wide is more than the hero can ever show, and nobody
                 * has to remember to export at the right size.
                 */
                Forms\Components\Section::make('Artwork')
                    ->schema([
                        Forms\Components\FileUpload::make('image')
                            ->label('Desktop artwork')
                            ->helperText('Wide, roughly 3:1. PNG or JPG, up to 4 MB — larger images are scaled down to 1600px.')
                            ->disk('public')
                            ->directory('banners')
                            ->image()
                            ->maxSize(4096)
                            ->imageResizeMode('contain')
                            ->imageResizeTargetWidth('1600')
                            ->imageResizeUpscale(false)
                            ->required(),

                        Forms\Components\FileUpload::make('mobile_image')
                            ->label('Phone artwork (optional)')
                            ->helperText('A taller crop for phones. The desktop image is used when this is empty.')
                            ->disk('public')
                            ->directory('banners')
                            ->image()
                            ->maxSize(4096)
                            ->imageResizeMode('contain')
                            ->imageResizeTargetWidth('1000')
                            ->imageResizeUpscale(false),
                    ])->columns(2),

                Forms\Components\Section::make('Scheduling')
                    ->schema([
                        Forms\Components\Toggle::make('is_active')
                            ->label('Active')
                            ->default(true),

                        Forms\Components\DateTimePicker::make('starts_at')
                            ->label('Starts')
                            ->helperText('Leave empty to start immediately.'),

                        Forms\Components\DateTimePicker::make('ends_at')
                            ->label('Ends')
                            ->helperText('Leave empty to run until switched off.')
                            ->after('starts_at'),
                    ])->columns(3),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort_order')
            ->columns([
                Tables\Columns\ImageColumn::make('image')
                    ->label('Artwork')
                    ->disk('public'),

                Tables\Columns\TextColumn::make('title')
                    ->label('Title')
                    ->description(fn (Banner $record) => $record->subtitle)
                    ->searchable()
                    ->limit(40),

                Tables\Columns\TextColumn::make('placement')
                    ->label('Position')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'hero'      => 'Hero carousel',
                        'hero_side' => 'Hero side card',
                        'promo'     => 'Promo strip',
                        'archive'   => 'Archived',
                        default     => $state ?? '—',
                    })
                    ->color(fn (?string $state) => match ($state) {
                        'hero'      => 'success',
                        'hero_side' => 'info',
                        'promo'     => 'warning',
                        default     => 'gray',
                    }),

                Tables\Columns\TextColumn::make('sort_order')->label('Order')->sortable(),

                Tables\Columns\IconColumn::make('is_active')->label('Active')->boolean(),

                Tables\Columns\TextColumn::make('ends_at')
                    ->label('Ends')
                    ->dateTime('d M Y')
                    ->placeholder('—'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('placement')
                    ->options([
                        'hero'      => 'Hero carousel',
                        'hero_side' => 'Hero side card',
                        'promo'     => 'Promo strip',
                        'archive'   => 'Archived',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\DeleteBulkAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBanners::route('/'),
            'create' => Pages\CreateBanner::route('/create'),
            'edit' => Pages\EditBanner::route('/{record}/edit'),
        ];
    }
}
