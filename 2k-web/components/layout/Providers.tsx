"use client";

import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/store/auth";
import { CartProvider } from "@/lib/store/cart";
import { LocationProvider } from "@/lib/store/location";
import { WishlistProvider } from "@/lib/store/wishlist";

/**
 * App-wide state providers.
 *
 * Mounted in the root layout rather than inside <SiteChrome> so that *any*
 * page — storefront, vendor portal or auth screen — can call useCart(),
 * useAuth() or useWishlist() at its top level. Nesting the providers below the
 * page component meant a page that read state before rendering its chrome
 * threw "must be used inside <Provider>".
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Language is outermost: every other provider's user-facing text reads
    // from it.
    //
    // There is no first-visit language gate. English is the default and the
    // switcher sits in the header and footer, so a new visitor lands on the
    // storefront rather than on a modal asking them a question before they
    // have seen what this is.
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              {children}
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}

export default Providers;
