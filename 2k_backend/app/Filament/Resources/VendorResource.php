<?php

namespace App\Filament\Resources;

use App\Filament\Resources\VendorResource\Pages;
use App\Models\Vendor;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ToggleColumn;

class VendorResource extends Resource
{
    protected static ?string $model = Vendor::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-storefront';
    protected static ?string $navigationGroup = 'Sellers';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('business_name')->required(),
                Forms\Components\TextInput::make('phone')->required(),
                Forms\Components\TextInput::make('business_address')->required(),
                Forms\Components\Toggle::make('is_approved')->label('Approved'),
                // Add other fields as needed (email, nida_number, etc)
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('business_name')
                    ->label('Store')
                    ->description(fn (Vendor $record) => $record->user->name ?? null)
                    ->searchable()
                    ->sortable(),

                TextColumn::make('phone')->searchable()->toggleable(),

                // Two independent axes, deliberately given different visual
                // languages so they are never read as the same thing:
                //
                //   Selling      — may this store publish and sell at all?
                //   Verification — has an admin granted the public checkmark?
                //
                // An approved seller is not verified, and a verified store can
                // still be suspended. Same colours on both columns made them
                // look interchangeable at a glance, so selling stays the
                // green/amber/red permission signal while verification uses a
                // blue check badge, matching the mark shoppers see.
                TextColumn::make('seller_status')
                    ->label('Selling')
                    ->tooltip('Whether this store is allowed to publish and sell.')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'approved'  => 'Approved',
                        'pending'   => 'Pending review',
                        'rejected'  => 'Rejected',
                        'suspended' => 'Suspended',
                        default     => $state ?? '—',
                    })
                    ->icon(fn (?string $state) => match ($state) {
                        'approved'  => 'heroicon-m-check-circle',
                        'pending'   => 'heroicon-m-clock',
                        'rejected'  => 'heroicon-m-x-circle',
                        'suspended' => 'heroicon-m-no-symbol',
                        default     => 'heroicon-m-question-mark-circle',
                    })
                    ->color(fn (?string $state) => match ($state) {
                        'approved'  => 'success',
                        'pending'   => 'warning',
                        'rejected', 'suspended' => 'danger',
                        default     => 'gray',
                    }),

                TextColumn::make('verification_status')
                    ->label('Verification')
                    ->tooltip('The public checkmark. Granted by an admin only — never automatic.')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => match ($state) {
                        'verified' => 'Verified',
                        'pending'  => 'Awaiting review',
                        'rejected' => 'Rejected',
                        default    => 'Not verified',
                    })
                    ->icon(fn (?string $state) => match ($state) {
                        'verified' => 'heroicon-m-check-badge',
                        'pending'  => 'heroicon-m-clock',
                        'rejected' => 'heroicon-m-x-circle',
                        default    => 'heroicon-m-minus-circle',
                    })
                    ->color(fn (?string $state) => match ($state) {
                        'verified' => 'info',
                        'pending'  => 'warning',
                        'rejected' => 'danger',
                        default    => 'gray',
                    }),

                TextColumn::make('documents_count')
                    ->counts('documents')
                    ->label('Docs'),

                TextColumn::make('created_at')->label('Joined')->date('d M Y')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('seller_status')
                    ->label('Selling status')
                    ->options([
                        'pending'   => 'Pending review',
                        'approved'  => 'Approved',
                        'rejected'  => 'Rejected',
                        'suspended' => 'Suspended',
                    ]),
                Tables\Filters\SelectFilter::make('verification_status')
                    ->label('Verification')
                    ->options([
                        'none'     => 'Not applied',
                        'pending'  => 'Awaiting review',
                        'verified' => 'Verified',
                        'rejected' => 'Rejected',
                    ]),
            ])
            // Seven inline actions overflowed the row and clipped at the right
            // edge. Grouping them into the two decisions an admin actually
            // makes fixes that and keeps the distinction obvious: one menu
            // decides whether the store may trade, the other decides whether
            // it carries the public checkmark.
            ->actions([
                Tables\Actions\ActionGroup::make([
                // ---- level 1: may this seller trade? ----
                Tables\Actions\Action::make('approve')
                    ->label('Approve seller')
                    ->icon('heroicon-o-check-badge')
                    ->color('success')
                    ->visible(fn (Vendor $record) => $record->seller_status !== 'approved')
                    ->requiresConfirmation()
                    ->modalDescription('The seller will be able to publish products immediately.')
                    ->action(function (Vendor $record) {
                        $record->update([
                            'is_approved'   => true,
                            'seller_status' => 'approved',
                            'approved_at'   => now(),
                            'admin_note'    => null,
                        ]);
                    }),

                Tables\Actions\Action::make('reject')
                    ->label('Reject')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn (Vendor $record) => $record->seller_status === 'pending')
                    ->form([
                        Forms\Components\Textarea::make('admin_note')
                            ->label('What does the seller need to change?')
                            ->helperText('Shown to the seller on their dashboard.')
                            ->required(),
                    ])
                    ->action(function (Vendor $record, array $data) {
                        $record->update([
                            'is_approved'   => false,
                            'seller_status' => 'rejected',
                            'admin_note'    => $data['admin_note'],
                        ]);
                    }),

                Tables\Actions\Action::make('suspend')
                    ->label('Suspend')
                    ->icon('heroicon-o-pause-circle')
                    ->color('danger')
                    ->visible(fn (Vendor $record) => $record->seller_status === 'approved')
                    ->form([
                        Forms\Components\Textarea::make('admin_note')->label('Reason')->required(),
                    ])
                    ->requiresConfirmation()
                    ->action(function (Vendor $record, array $data) {
                        // Products stay in place; the seller simply cannot
                        // publish or change them while suspended.
                        $record->update([
                            'is_approved'   => false,
                            'seller_status' => 'suspended',
                            'admin_note'    => $data['admin_note'],
                        ]);
                    }),
                ])
                    ->label('Selling')
                    ->icon('heroicon-m-check-circle')
                    ->color('gray')
                    ->button(),

                Tables\Actions\ActionGroup::make([
                // ---- level 2: the checkmark ----
                Tables\Actions\Action::make('verify')
                    ->label('Grant verification')
                    ->icon('heroicon-o-shield-check')
                    ->color('success')
                    // Available for any store that is not already verified, not
                    // only for ones that filed an application. A Kariakoo trader
                    // an admin knows and trusts can be verified directly; tying
                    // the action to a pending application meant a store that
                    // never applied could never be verified at all.
                    ->visible(fn (Vendor $record) => ! $record->is_verified)
                    ->requiresConfirmation()
                    ->modalDescription('The verified checkmark will appear on this store and all of its products.')
                    ->action(function (Vendor $record) {
                        $record->update([
                            'is_verified'         => true,
                            'verification_status' => 'verified',
                            'verified_at'         => now(),
                            'verification_note'   => null,
                        ]);
                        $record->documents()->update(['status' => 'approved', 'reviewed_at' => now()]);
                    }),

                Tables\Actions\Action::make('rejectVerification')
                    ->label('Reject verification')
                    ->icon('heroicon-o-x-mark')
                    ->color('danger')
                    ->visible(fn (Vendor $record) => $record->verification_status === 'pending')
                    ->form([
                        Forms\Components\Textarea::make('verification_note')
                            ->label('What is missing or wrong?')
                            ->required(),
                    ])
                    ->action(function (Vendor $record, array $data) {
                        $record->update([
                            'is_verified'         => false,
                            'verification_status' => 'rejected',
                            'verification_note'   => $data['verification_note'],
                        ]);
                    }),

                Tables\Actions\Action::make('revokeVerification')
                    ->label('Revoke badge')
                    ->icon('heroicon-o-shield-exclamation')
                    ->color('danger')
                    ->visible(fn (Vendor $record) => (bool) $record->is_verified)
                    ->requiresConfirmation()
                    ->action(fn (Vendor $record) => $record->update([
                        'is_verified'         => false,
                        'verification_status' => 'rejected',
                    ])),
                ])
                    ->label('Verification')
                    ->icon('heroicon-m-check-badge')
                    ->color('gray')
                    ->button(),

                Tables\Actions\ViewAction::make()->iconButton(),
                Tables\Actions\EditAction::make()->iconButton(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListVendors::route('/'),
            'create' => Pages\CreateVendor::route('/create'),
            'edit'   => Pages\EditVendor::route('/{record}/edit'),
            // Remove 'view' if you did not generate a ViewVendor page
        ];
    }
}
