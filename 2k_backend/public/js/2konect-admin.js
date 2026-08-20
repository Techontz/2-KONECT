/*
 * 2KONECT — admin panel behaviour.
 *
 * Filament stores the sidebar's open state as `$persist(true)`, which is right
 * on a desktop where the sidebar is a permanent column. On a phone the same
 * store drives an off-canvas drawer, so the default lands every admin on a
 * page whose content is completely covered by navigation until they dismiss it.
 *
 * Below the `lg` breakpoint the drawer starts closed, which is how a drawer is
 * expected to behave. The trigger in the topbar still opens it, and desktop
 * behaviour is untouched because the media query simply does not match there.
 */
;(function () {
    // Matches Tailwind's `lg`, the width at which Filament makes the sidebar
    // a static column rather than an overlay.
    var BELOW_LG = '(max-width: 1023.98px)'

    function closeDrawerOnSmallScreens() {
        if (! window.matchMedia(BELOW_LG).matches) {
            return
        }

        var sidebar = window.Alpine && window.Alpine.store
            ? window.Alpine.store('sidebar')
            : null

        if (sidebar && sidebar.isOpen) {
            sidebar.isOpen = false
        }
    }

    // `alpine:initialized` rather than `alpine:init`: the store Filament
    // registers does not exist yet at init time.
    document.addEventListener('alpine:initialized', closeDrawerOnSmallScreens)

    // Livewire keeps the page alive across navigations, so re-close after one.
    document.addEventListener('livewire:navigated', closeDrawerOnSmallScreens)
})()
