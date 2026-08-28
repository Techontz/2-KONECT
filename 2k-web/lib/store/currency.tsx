"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { invalidateQueries } from "@/lib/cache";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type CurrencyCode,
  formatCurrency,
  getActiveCurrency,
  isCurrency,
  readStoredCurrency,
  setActiveCurrency,
  writeStoredCurrency,
} from "@/lib/currency";

/**
 * Which currency this visitor is reading prices in.
 *
 * ---- the order of precedence, and why ----
 *
 *   1. what they chose on this visit
 *   2. what they chose on a previous visit
 *   3. what their country suggests
 *   4. the application default
 *
 * The first two beat the third on purpose, and that is the whole rule: a
 * Tanzanian who picks dollars keeps dollars, in Dar es Salaam and everywhere
 * else, on this visit and every one after. Detection decides what somebody is
 * offered before they have an opinion; it never overrules one they have.
 *
 * ---- why detection is a request and not a hook ----
 *
 * Country comes from `GET /shop/currency`, which reads the headers Vercel and
 * Cloudflare already put on the request. No GPS, no permission prompt, no
 * external service. A visitor whose country cannot be determined is not
 * blocked — they simply get the default and the switcher, which is what the
 * switcher is for.
 *
 * ---- hydration ----
 *
 * The first render is always the default, on the server and on the client,
 * because localStorage does not exist on the server and a mismatch there is a
 * hydration error rather than a nice touch. The stored choice is applied in an
 * effect, one paint later. `ready` says which of the two you are looking at.
 */
interface CurrencyState {
  currency: CurrencyCode;
  /** False until the stored preference and detection have been resolved. */
  ready: boolean;
  /** True once the visitor has made an explicit choice, ever. */
  chosen: boolean;
  setCurrency: (code: CurrencyCode) => void;
  /** `TZS 50,000` / `$20.00`, in the active currency. */
  format: (amount: number | null | undefined) => string;
  options: typeof CURRENCIES;
}

const CurrencyContext = createContext<CurrencyState | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  // ---- 1 & 2: a choice already made ----
  useEffect(() => {
    const stored = readStoredCurrency();

    if (stored) {
      setActiveCurrency(stored);
      setCurrencyState(stored);
      setChosen(true);
      setReady(true);
      return;
    }

    // ---- 3: what does their country suggest? ----
    let live = true;

    api
      .get<{ suggested_currency?: string; detected?: boolean }>("/shop/currency")
      .then(({ data }) => {
        if (!live) return;

        const suggested = data?.suggested_currency;

        if (isCurrency(suggested)) {
          setActiveCurrency(suggested);
          setCurrencyState(suggested);
        }
      })
      .catch(() => {
        // ---- 4: detection failed, and that is survivable ----
        // The default is already in state. A visitor must never be unable to
        // shop because a geolocation header was missing.
      })
      .finally(() => {
        if (live) setReady(true);
      });

    return () => {
      live = false;
    };
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    if (!isCurrency(code) || code === getActiveCurrency()) return;

    // The interceptor reads this, so it must be set before anything refetches.
    setActiveCurrency(code);
    writeStoredCurrency(code);
    setCurrencyState(code);
    setChosen(true);

    // Every cached page holds prices in the currency it was fetched in, so
    // they are all now wrong. Dropped rather than converted: converting a
    // cached figure on the client is the thing this system exists to avoid.
    invalidateQueries("");
  }, []);

  const value = useMemo<CurrencyState>(
    () => ({
      currency,
      ready,
      chosen,
      setCurrency,
      format: (amount) => formatCurrency(amount, currency),
      options: CURRENCIES,
    }),
    [currency, ready, chosen, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyState {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used inside <CurrencyProvider>.");
  }

  return context;
}

/**
 * Formatting without needing the provider.
 *
 * For the handful of places that render money outside the React tree the
 * provider wraps. Reads the same single value the interceptor does, so it can
 * never disagree with what was requested.
 */
export function formatActive(amount: number | null | undefined): string {
  return formatCurrency(amount, getActiveCurrency());
}
