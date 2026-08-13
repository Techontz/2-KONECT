"use client";

import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/store/auth";
import { CartProvider } from "@/lib/store/cart";
import { LocationProvider } from "@/lib/store/location";
import { WishlistProvider } from "@/lib/store/wishlist";
import { LanguageGate } from "./LanguageGate";

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
    // Language is outermost: every other provider's user-facing text, and the
    // first-visit gate itself, reads from it.
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              {children}
              <LanguageGate />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}

export default Providers;
