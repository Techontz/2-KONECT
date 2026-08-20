{{--
    2KONECT — layout for the panel's authentication pages.

    Overrides Filament's simple layout to place a branded rail beside the form.
    It still delegates to `layout.base`, so every stylesheet, script, Livewire
    binding and render hook Filament expects is untouched — only the
    composition around the slot changes.

    The rail is hidden below `lg` (see k-admin.css); a compact wordmark takes
    its place so a phone gets the brand without the decoration.
--}}
@php
    use Filament\Support\Enums\MaxWidth;

    $livewire ??= null;
@endphp

<x-filament-panels::layout.base :livewire="$livewire">
    @props([
        'after' => null,
        'heading' => null,
        'subheading' => null,
    ])

    <div class="fi-simple-layout k-auth-shell">
        <aside class="k-brand-rail" aria-hidden="true">
            <p class="k-wordmark">2<span>KONECT</span></p>

            <div>
                <p class="k-rail-eyebrow">Admin Centre</p>
                <h2 class="k-rail-title">The control room for 2KONECT.</h2>
                <p class="k-rail-copy">
                    Approve sellers, source what shoppers ask for, move imports through
                    customs and keep every order tracked &mdash; from one place.
                </p>

                {{-- `$livewire` is the page component; `$this` inside a Blade
                     component is the component itself, not the page. The
                     method check keeps this layout usable by the other auth
                     pages (password reset, verification) that do not define
                     it. --}}
                @php
                    $brandStats = ($livewire && method_exists($livewire, 'getBrandStats'))
                        ? $livewire->getBrandStats()
                        : [];
                @endphp

                <dl class="k-rail-stats">
                    @foreach ($brandStats as $stat)
                        <div>
                            <dd class="k-rail-stat-value">{{ $stat['value'] }}</dd>
                            <dt class="k-rail-stat-label">{{ $stat['label'] }}</dt>
                        </div>
                    @endforeach
                </dl>
            </div>

            <p class="k-rail-foot">2KONECT &middot; Dar es Salaam, Tanzania</p>
        </aside>

        <div class="fi-simple-main-ctn k-auth-form-side">
            <main class="fi-simple-main k-auth-card">
                <div class="k-mobile-brand">
                    <p class="k-wordmark">2<span>KONECT</span></p>
                </div>

                {{ $slot }}
            </main>
        </div>

        {{ \Filament\Support\Facades\FilamentView::renderHook(\Filament\View\PanelsRenderHook::FOOTER, scopes: $livewire?->getRenderHookScopes()) }}
    </div>
</x-filament-panels::layout.base>
