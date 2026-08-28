/**
 * Currency, on the client.
 *
 * ---- this file does not convert ----
 *
 * It used to. `lib/format.ts` held `RATES = { USD: 0.000387 }`, a second copy
 * of a rate that also lived in the backend, in the opposite direction, with
 * nothing keeping the two in step. Whichever drifted first would have shown a
 * customer one price on the product page and another in the basket.
 *
 * The server converts now. Every price on every response arrives already in
 * the currency the request asked for, at the rate an administrator set, with
 * the canonical figure beside it. So the client's whole job is to say which
 * currency it wants and to put a symbol around what comes back.
 *
 * If you ever want a rate here, the one you want is on the payload — and
 * needing it means the sum belongs on the server.
 */

export type CurrencyCode = "TZS" | "USD";

export const CURRENCIES: ReadonlyArray<{
  code: CurrencyCode;
  label: string;
  short: string;
  flag: string;
  symbol: string;
}> = [
  { code: "TZS", label: "Tanzanian Shilling", short: "TZS", flag: "🇹🇿", symbol: "TZS" },
  { code: "USD", label: "US Dollar", short: "USD", flag: "🇺🇸", symbol: "$" },
];

export const DEFAULT_CURRENCY: CurrencyCode = "TZS";

export const CURRENCY_STORAGE_KEY = "2konect.currency";

/** The header the API reads. Must match ResolveDisplayCurrency::KEY's source. */
export const CURRENCY_HEADER = "X-Currency";

export function isCurrency(value: unknown): value is CurrencyCode {
  return value === "TZS" || value === "USD";
}

/* ------------------------------------------------------------------ */
/* the active currency, outside React                                  */
/* ------------------------------------------------------------------ */

/**
 * Axios cannot read a React context, and a request fired from an event
 * handler must not send a currency one render out of date. So the active
 * choice is mirrored here, written by the provider and read by the request
 * interceptor. One value, one writer.
 */
let active: CurrencyCode = DEFAULT_CURRENCY;

export function getActiveCurrency(): CurrencyCode {
  return active;
}

export function setActiveCurrency(code: CurrencyCode): void {
  active = code;
}

/**
 * The currency stored from a previous visit, if any.
 *
 * Returns null rather than a default, because "they chose TZS" and "they have
 * never chosen" are different facts: the first must survive a trip to another
 * country, the second must not override one.
 */
export function readStoredCurrency(): CurrencyCode | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return isCurrency(raw) ? raw : null;
  } catch {
    // Private browsing, or storage disabled. Not a reason to fail.
    return null;
  }
}

export function writeStoredCurrency(code: CurrencyCode): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    /* The choice still applies to this visit; it just will not outlive it. */
  }
}

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

const FRACTION_DIGITS: Record<CurrencyCode, number> = {
  // Shillings are quoted whole. "TZS 49,999.83" is not a price anyone has
  // charged in Tanzania — it is an artefact of dividing.
  TZS: 0,
  USD: 2,
};

export function currencyDecimals(code: CurrencyCode): number {
  return FRACTION_DIGITS[code] ?? 0;
}

/**
 * `TZS 50,000` / `$20.00`.
 *
 * The amount is taken as already being in `code` — this is display, not
 * conversion. Null, undefined and NaN render as an empty string rather than
 * "NaN", because a missing price should look missing, not broken.
 */
export function formatCurrency(
  amount: number | null | undefined,
  code: CurrencyCode = DEFAULT_CURRENCY,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";

  const digits = currencyDecimals(code);
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  const sign = amount < 0 ? "-" : "";

  return code === "USD" ? `${sign}$${formatted}` : `${sign}TZS ${formatted}`;
}

/** The bare number, for tight layouts where the label is already on screen. */
export function formatCurrencyAmount(
  amount: number | null | undefined,
  code: CurrencyCode = DEFAULT_CURRENCY,
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";

  const digits = currencyDecimals(code);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
