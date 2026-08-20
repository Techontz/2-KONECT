<?php

namespace App\Filament\Resources;

use App\Filament\Resources\VendorApplicationResource\Pages;
use App\Models\Vendor;
use App\Models\VendorApplication;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\DB;

/**
 * The seller front door.
 *
 * Nobody becomes a seller by registering — an application lands here and an
 * administrator decides. Approving is what creates the vendor record and
 * flips the account's role, so the storefront's seller list stays curated.
 */
class VendorApplicationResource extends Resource
{
    protected static ?string $model = VendorApplication::class;
    protected static ?string $navigationIcon = 'heroicon-o-building-storefront';
    protected static ?string $navigationGroup = 'Sourcing';
    protected static ?string $navigationLabel = 'Seller applications';
    protected static ?int $navigationSort = 2;
    protected static ?string $recordTitleAttribute = 'business_name';

    public static function getNavigationBadge(): ?string
    {
        $open = static::getModel()::whereIn('status', ['pending', 'reviewing'])->count();

        return $open > 0 ? (string) $open : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Applicant')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('reference')->disabled()->dehydrated(false),
                    Forms\Components\TextInput::make('business_name')->required(),
                    Forms\Components\TextInput::make('full_name')->label('Contact person'),
                    Forms\Components\TextInput::make('phone')->tel(),
                    Forms\Components\TextInput::make('email')->email(),
                    Forms\Components\TextInput::make('website'),
                    Forms\Components\TextInput::make('region'),
                    Forms\Components\TextInput::make('city'),
                    Forms\Components\TextInput::make('business_type'),
                    Forms\Components\TextInput::make('category'),
                    Forms\Components\TextInput::make('id_number')->label('ID / registration number'),
                    Forms\Components\Textarea::make('products')
                        ->label('What they want to sell')->rows(3)->columnSpanFull(),
                ]),

            Forms\Components\Section::make('Decision')
                ->columns(2)
                ->schema([
                    Forms\Components\Select::make('status')
                        ->options(collect(VendorApplication::STATUSES)
                            ->mapWithKeys(fn ($s) => [$s => ucfirst($s)])->all())
                        ->required()
                        ->native(false),
                    Forms\Components\DateTimePicker::make('reviewed_at'),
                    Forms\Components\Textarea::make('admin_note')
                        ->label('Note to the applicant')->rows(2)->columnSpanFull(),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('reference')->searchable()->copyable()->weight('bold')
                    ->description(fn (VendorApplication $a) => $a->created_at?->diffForHumans()),

                Tables\Columns\TextColumn::make('business_name')->searchable()
                    ->description(fn (VendorApplication $a) => $a->category),

                Tables\Columns\TextColumn::make('full_name')->label('Contact')->searchable()
                    ->description(fn (VendorApplication $a) => $a->phone),

                Tables\Columns\TextColumn::make('city')->toggleable(),

                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $s) => match ($s) {
                        'approved' => 'success',
                        'rejected' => 'danger',
                        'pending'  => 'warning',
                        default    => 'info',
                    })
                    ->sortable(),

                Tables\Columns\TextColumn::make('vendor.business_name')->label('Seller account')->toggleable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->options(
                    collect(VendorApplication::STATUSES)->mapWithKeys(fn ($s) => [$s => ucfirst($s)])->all()
                ),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),

                Tables\Actions\Action::make('approve')
                    ->label('Approve & create seller')
                    ->icon('heroicon-m-check-badge')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalDescription('Creates the seller account and lets them publish products.')
                    ->visible(fn (VendorApplication $a) => $a->status !== 'approved')
                    ->action(function (VendorApplication $application) {
                        DB::transaction(function () use ($application) {
                            // Reuse an existing seller record rather than
                            // creating a second one for the same account.
                            $vendor = $application->vendor_id
                                ? Vendor::find($application->vendor_id)
                                : ($application->user_id ? Vendor::where('user_id', $application->user_id)->first() : null);

                            $vendor ??= new Vendor(['user_id' => $application->user_id]);

                            $vendor->fill([
                                'business_name'    => $application->business_name,
                                'phone'            => $application->phone,
                                'email'            => $application->email,
                                'website'          => $application->website,
                                'business_address' => trim(($application->city ?? '') . ' ' . ($application->region ?? '')) ?: null,
                                'is_approved'      => true,
                                'seller_status'    => 'approved',
                                'approved_at'      => now(),
                            ])->save();

                            // The account has to be able to reach the seller
                            // console, or approval is only half done.
                            if ($application->user) {
                                $application->user->update(['role' => 'vendor']);
                            }

                            $application->update([
                                'status'      => 'approved',
                                'reviewed_at' => now(),
                                'vendor_id'   => $vendor->id,
                            ]);
                        });

                        Notification::make()->success()
                            ->title('Seller approved')
                            ->body($application->business_name . ' can now publish products.')
                            ->send();
                    }),

                Tables\Actions\Action::make('reject')
                    ->icon('heroicon-m-x-circle')
                    ->color('danger')
                    ->visible(fn (VendorApplication $a) => $a->status !== 'rejected')
                    ->form([
                        Forms\Components\Textarea::make('admin_note')->label('Reason (shown to the applicant)')->rows(2),
                    ])
                    ->action(function (VendorApplication $application, array $data) {
                        $application->update([
                            'status'      => 'rejected',
                            'admin_note'  => $data['admin_note'] ?? null,
                            'reviewed_at' => now(),
                        ]);

                        Notification::make()->success()->title('Application rejected')->send();
                    }),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListVendorApplications::route('/'),
            'edit'  => Pages\EditVendorApplication::route('/{record}/edit'),
        ];
    }
}
