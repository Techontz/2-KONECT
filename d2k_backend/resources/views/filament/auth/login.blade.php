{{--
    Sign-in card.

    The form itself is Filament's — `$this->form` and `wire:submit="authenticate"`
    are the framework's own bindings, so validation, throttling and the
    "credentials do not match" handling all behave exactly as before. Only the
    heading, supporting copy and footer are ours.
--}}
<x-filament-panels::page.simple>
    <header class="d2k-card-head">
        <span class="d2k-card-mark" aria-hidden="true">D2K</span>
        <h1 class="d2k-card-title">Welcome back</h1>
        <p class="d2k-card-sub">Sign in to the Direct2Kariakoo Admin Centre.</p>
    </header>

    {{ \Filament\Support\Facades\FilamentView::renderHook(\Filament\View\PanelsRenderHook::AUTH_LOGIN_FORM_BEFORE, scopes: $this->getRenderHookScopes()) }}

    <x-filament-panels::form id="form" wire:submit="authenticate">
        {{ $this->form }}

        <x-filament-panels::form.actions
            :actions="$this->getCachedFormActions()"
            :full-width="$this->hasFullWidthFormActions()"
        />
    </x-filament-panels::form>

    {{ \Filament\Support\Facades\FilamentView::renderHook(\Filament\View\PanelsRenderHook::AUTH_LOGIN_FORM_AFTER, scopes: $this->getRenderHookScopes()) }}

    <p class="d2k-card-foot">
        This is a restricted area for Direct2Kariakoo staff.<br>
        Trouble signing in? Contact your system administrator.
    </p>
</x-filament-panels::page.simple>
