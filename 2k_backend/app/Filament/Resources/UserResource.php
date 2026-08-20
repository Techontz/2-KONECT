<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Columns\ToggleColumn;
use Illuminate\Support\Facades\Hash;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';
    protected static ?string $navigationGroup = 'Orders & customers';
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required()
                    ->maxLength(255),

                Forms\Components\TextInput::make('email')
                    ->email()
                    ->required()
                    ->maxLength(255),

                Forms\Components\TextInput::make('phone')
                    ->required()
                    ->maxLength(20),

                Forms\Components\TextInput::make('address')
                    ->maxLength(255),

                Forms\Components\Select::make('role')
                    ->options([
                        'user'   => 'User',
                        'vendor' => 'Vendor',
                        'admin'  => 'Admin',
                    ])
                    ->required(),

                // Optional: Enable/disable users if you have a status field
                // Forms\Components\Toggle::make('is_active')->label('Active'),

                // `PasswordInput` is not a Filament component — the correct
                // form is a text input switched to password mode, which is why
                // this page returned a 500 for every "New user" attempt.
                //
                // The model has no `hashed` cast, so the value is hashed here.
                // Without that, anything typed would be written to the users
                // table in plain text and the account could never log in.
                //
                // On edit the field is optional and never pre-filled: leaving
                // it blank keeps the existing password, and only a typed value
                // is written. Without this, there was no way at all to change
                // an account's password from the panel.
                Forms\Components\TextInput::make('password')
                    ->label(fn (string $operation) => $operation === 'create' ? 'Password' : 'New password')
                    ->helperText(fn (string $operation) => $operation === 'create'
                        ? null
                        : 'Leave blank to keep the current password.')
                    ->password()
                    ->revealable()
                    ->minLength(8)
                    ->maxLength(255)
                    ->required(fn (string $operation) => $operation === 'create')
                    // Never show the stored hash in the field.
                    ->afterStateHydrated(fn (Forms\Components\TextInput $component) => $component->state(null))
                    ->dehydrated(fn (?string $state) => filled($state))
                    ->dehydrateStateUsing(fn (string $state): string => Hash::make($state)),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->sortable(),
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('email')->searchable(),
                TextColumn::make('phone')->searchable(),
                TextColumn::make('role')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'admin' => 'danger',
                        'vendor' => 'success',
                        'user' => 'gray',
                        default => 'gray',
                    })
                    ->sortable(),
                TextColumn::make('address')->limit(18),
                TextColumn::make('created_at')->dateTime('d-M-Y H:i')->sortable(),
            ])
            ->filters([
                // Example: filter by role
                // Tables\Filters\SelectFilter::make('role')
                //     ->options([
                //         'user' => 'User',
                //         'vendor' => 'Vendor',
                //         'admin' => 'Admin',
                //     ]),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            // Add RelationManagers here if needed, e.g., for orders, vendor, etc.
        ];
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit'   => Pages\EditUser::route('/{record}/edit'),
            // 'view'   => Pages\ViewUser::route('/{record}'), // Uncomment if you generate ViewUser page
        ];
    }
}
