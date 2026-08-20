"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import shop from "../shop";
import { useAuth } from "./auth";

/**
 * Wishlist.
 *
 * Guests save items locally; signing in merges that local list into the
 * account rather than discarding it, so nothing a visitor saved before
 * registering is lost. Once authenticated the server is the source of truth.
 */

interface WishlistContextValue {
  ids: number[];
  count: number;
  has(productId: number): boolean;
  toggle(productId: number): Promise<void>;
  remove(productId: number): Promise<void>;
}

const STORAGE_KEY = "2konect.wishlist.v1";
/** The pre-rename key, read once so saved items survive the rebrand. */
const LEGACY_STORAGE_KEY = "d2k.wishlist.v1";
const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const [ids, setIds] = useState<number[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  // On sign-in, push the guest list up and adopt the merged result.
  useEffect(() => {
    if (!ready || !isAuthenticated || !hydrated.current) return;

    const local = ids;
    const request = local.length ? shop.syncWishlist(local) : shop.wishlist();

    request
      .then((data) => setIds(data.ids))
      .catch(() => undefined);
    // Runs on the sign-in transition only — `ids` is intentionally not a
    // dependency, otherwise every local toggle would re-sync the whole list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, ready]);

  const toggle = useCallback(
    async (productId: number) => {
      const saved = ids.includes(productId);

      // Optimistic: the heart responds immediately, the request follows.
      setIds((current) =>
        saved ? current.filter((id) => id !== productId) : [...current, productId]
      );

      if (!isAuthenticated) return;

      try {
        if (saved) await shop.removeFromWishlist(productId);
        else await shop.addToWishlist(productId);
      } catch {
        // Roll back so the icon never lies about what was saved.
        setIds((current) =>
          saved ? [...current, productId] : current.filter((id) => id !== productId)
        );
      }
    },
    [ids, isAuthenticated]
  );

  const remove = useCallback(
    async (productId: number) => {
      setIds((current) => current.filter((id) => id !== productId));
      if (isAuthenticated) {
        await shop.removeFromWishlist(productId).catch(() => undefined);
      }
    },
    [isAuthenticated]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      toggle,
      remove,
    }),
    [ids, toggle, remove]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return context;
}
