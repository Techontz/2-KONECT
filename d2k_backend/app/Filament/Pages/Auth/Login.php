<?php

namespace App\Filament\Pages\Auth;

use App\Models\Product;
use App\Models\Vendor;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\TextInput;
use Filament\Pages\Auth\Login as BaseLogin;

/**
 * Direct2Kariakoo admin sign-in.
 *
 * Extends Filament's own login page rather than replacing it, so the
 * authentication, throttling, session handling and error messages are all
 * still Filament's. What changes here is the copy, the field presentation and
 * the figures shown on the branded rail beside the form.
 */
class Login extends BaseLogin
{
    protected static string $view = 'filament.auth.login';

    /**
     * Real catalogue figures for the sign-in rail.
     *
     * Read from the database on every render — an admin sees the marketplace
     * they are about to manage, not decoration. Any failure (a database that
     * is not reachable yet) returns nothing rather than taking the login page
     * down with it, because being unable to sign in is the worse outcome.
     */
    /**
     * The card carries its own mark and heading, so Filament's centred logo
     * and "Sign in" title would simply be a second copy of both. They are
     * suppressed here rather than hidden in CSS, so nothing is emitted at all.
     */
    public function hasLogo(): bool
    {
        return false;
    }

    public function getHeading(): string
    {
        return '';
    }

    public function getBrandStats(): array
    {
        try {
            return [
                ['value' => number_format(Product::count()), 'label' => 'Products'],
                ['value' => number_format(Vendor::where('is_approved', true)->count()), 'label' => 'Active sellers'],
                ['value' => number_format(Vendor::where('seller_status', 'pending')->count()), 'label' => 'Awaiting review'],
            ];
        } catch (\Throwable) {
            return [];
        }
    }

    protected function getEmailFormComponent(): Component
    {
        return TextInput::make('email')
            ->label('Email address')
            ->placeholder('you@direct2kariakoo.com')
            ->email()
            ->required()
            // Named rather than bare, so password managers offer the
            // right credential instead of guessing.
            ->autocomplete('username')
            ->autofocus()
            ->extraInputAttributes(['tabindex' => 1]);
    }

    protected function getPasswordFormComponent(): Component
    {
        return TextInput::make('password')
            ->label('Password')
            ->placeholder('Enter your password')
            ->password()
            // Filament's own reveal control — accessible and already wired.
            ->revealable(filament()->arePasswordsRevealable())
            ->autocomplete('current-password')
            ->required()
            ->extraInputAttributes(['tabindex' => 2]);
    }
}
