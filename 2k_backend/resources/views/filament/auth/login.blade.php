{{--
    Sign-in card.

    The form itself is Filament's — `$this->form` and `wire:submit="authenticate"`
    are the framework's own bindings, so validation, throttling and the
    "credentials do not match" handling all behave exactly as before. Only the
    heading, supporting copy and footer are ours.
--}}
<x-filament-panels::page.simple>
    <header class="k-card-head">
        <img class="k-card-mark" src="{{ asset('img/2konect-mark.png') }}" alt="" width="40" height="40">
        <h1 class="k-card-title">Welcome back</h1>
        <p class="k-card-sub">Sign in to the 2KONECT Admin Centre.</p>
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

    <p class="k-card-foot">
        This is a restricted area for 2KONECT staff.<br>
        Trouble signing in? Contact your system administrator.
    </p>
</x-filament-panels::page.simple>
