/**
 * Money formatting for the storefront.
 *
 * ---- there is one currency ----
 *
 * 2KONECT prices in Tanzanian Shillings and shows Tanzanian Shillings. There
 * is no customer currency selector and no vendor currency field, so a price
 * has nothing to be converted into and nothing here converts.
 *
 * That is deliberate rather than incidental. This file previously held a
 * hardcoded rate; then the rate moved to the server and this file merely
 * chose a currency to ask for. Both arrangements shared one property — a
 * shelf price depended on an exchange rate being right — and when the rate
 * was wrong the whole catalogue was wrong with it. Now a stored 7000 is
 * TZS 7,000 by construction, and no rate can reach it.
 *
 * Orders are a separate matter. One agreed in another currency carries its
 * own snapshot and renders from that, which is why `formatCurrency` still
 * takes a currency at all.
 */

export type CurrencyCode = "TZS" | "USD";

/** The marketplace currency. The only one a customer or vendor ever sees. */
export const DEFAULT_CURRENCY: CurrencyCode = "TZS";

export function isCurrency(value: unknown): value is CurrencyCode {
  return value === "TZS" || value === "USD";
}

const FRACTION_DIGITS: Record<CurrencyCode, number> = {
  // Shillings are quoted whole. "TZS 49,999.83" is not a price anyone has
  // charged in Tanzania — it is an artefact of dividing, and nothing divides.
  TZS: 0,
  USD: 2,
};

export function currencyDecimals(code: CurrencyCode): number {
  return FRACTION_DIGITS[code] ?? 0;
}

/**
 * The currency every marketplace price is in.
 *
 * Kept as a function rather than inlining the constant so the handful of call
 * sites that ask read as a question with one answer, instead of quietly
 * assuming.
 */
export function getActiveCurrency(): CurrencyCode {
  return DEFAULT_CURRENCY;
}

/**
 * `TZS 50,000` / `$20.00`.
 *
 * The amount is already in `code`. This puts a symbol and the right number of
 * digits around it and does nothing else — no conversion has happened here
 * since the server took that job, and none happens now that there is only one
 * currency to be in.
 *
 * `USD` remains formattable for one reason: an order agreed in dollars before
 * the selector was removed still has to render its own total correctly.
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

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: currencyDecimals(code),
    maximumFractionDigits: currencyDecimals(code),
  });
}
