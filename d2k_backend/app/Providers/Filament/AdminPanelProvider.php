<?php

namespace App\Providers\Filament;

use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Assets\Css;
use Filament\Support\Assets\Js;
use Filament\Support\Colors\Color;
use Filament\Support\Facades\FilamentAsset;
use Filament\Widgets;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            // Extends Filament's own login page: same authentication,
            // different presentation.
            ->login(\App\Filament\Pages\Auth\Login::class)
            ->colors([
                // The 2KONECT purple is legible as an action colour, so unlike
                // the previous brand's yellow it can be the panel's primary
                // directly rather than being confined to the stylesheet.
                'primary' => Color::hex('#6d28d9'),
                'warning' => Color::Amber,
                'success' => Color::Emerald,
                'danger'  => Color::Rose,
            ])
            ->font('Inter')
            // One consistent surface. The storefront already pins itself to a
            // light scheme, and a half-themed dark panel — where only the
            // screens touched here follow the brand — reads as a bug rather
            // than a feature.
            ->darkMode(false)
            ->brandLogo(fn () => view('filament.brand-logo'))
            ->brandLogoHeight('1.75rem')
            ->favicon(asset('favicon.ico'))
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\Filament\\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\Filament\\Pages')
            ->pages([
                Pages\Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\Filament\\Widgets')
            ->widgets([
                // Marketplace health first, then the queues an admin acts on.
                // The stock Filament promo widget is dropped — this is a
                // working control centre, not a framework demo.
                \App\Filament\Widgets\MarketplaceOverview::class,
                \App\Filament\Widgets\SalesChart::class,
                \App\Filament\Widgets\PendingVendors::class,
                \App\Filament\Widgets\LowStockProducts::class,
            ])
            ->brandName('2KONECT')
            // Grouped so the sidebar reads as an operations centre rather than
            // an alphabetical list of database tables. These names must match
            // the $navigationGroup on each resource — the previous list named
            // groups ('Marketplace', 'People') that no resource used, so the
            // ordering silently did nothing.
            ->navigationGroups([
                'Catalogue',
                'Sellers',
                'Orders & customers',
                // Sourcing requests and seller applications: the two queues a
                // person actually works through every day.
                'Sourcing',
                'Storefront',
                'Settings',
            ])
            ->maxContentWidth('full')
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class, // Filament’s own
                \App\Http\Middleware\AdminOnly::class, // ✅ Custom role check
            ]);
    }

    /**
     * Load the 2KONECT stylesheet on every panel page.
     *
     * Registered as a Filament asset rather than injected into a view, so the
     * login screen, dashboard and every resource all receive it, and Filament
     * handles cache-busting.
     */
    public function boot(): void
    {
        FilamentAsset::register([
            Css::make('2konect-admin', asset('css/2konect-admin.css')),
            Js::make('2konect-admin', asset('js/2konect-admin.js')),
        ]);
    }
}
