{{--
    Direct2Kariakoo — layout for the panel's authentication pages.

    Overrides Filament's simple layout to place a branded rail beside the form.
    It still delegates to `layout.base`, so every stylesheet, script, Livewire
    binding and render hook Filament expects is untouched — only the
    composition around the slot changes.

    The rail is hidden below `lg` (see d2k-admin.css); a compact wordmark takes
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

    <div class="fi-simple-layout d2k-auth-shell">
        <aside class="d2k-brand-rail" aria-hidden="true">
            <p class="d2k-wordmark">direct<span>2kariakoo</span></p>

            <div>
                <p class="d2k-rail-eyebrow">Admin Centre</p>
                <h2 class="d2k-rail-title">The control room for Tanzania&rsquo;s marketplace.</h2>
                <p class="d2k-rail-copy">
                    Approve sellers, verify stores, manage the catalogue and keep orders
                    moving &mdash; all from one place.
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

                <dl class="d2k-rail-stats">
                    @foreach ($brandStats as $stat)
                        <div>
                            <dd class="d2k-rail-stat-value">{{ $stat['value'] }}</dd>
                            <dt class="d2k-rail-stat-label">{{ $stat['label'] }}</dt>
                        </div>
                    @endforeach
                </dl>
            </div>

            <p class="d2k-rail-foot">Direct2Kariakoo &middot; Dar es Salaam, Tanzania</p>
        </aside>

        <div class="fi-simple-main-ctn d2k-auth-form-side">
            <main class="fi-simple-main d2k-auth-card">
                <div class="d2k-mobile-brand">
                    <p class="d2k-wordmark">direct<span>2kariakoo</span></p>
                </div>

                {{ $slot }}
            </main>
        </div>

        {{ \Filament\Support\Facades\FilamentView::renderHook(\Filament\View\PanelsRenderHook::FOOTER, scopes: $livewire?->getRenderHookScopes()) }}
    </div>
</x-filament-panels::layout.base>
