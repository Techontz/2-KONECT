import { BRAND } from "./brand";

/**
 * Currency handling for the storefront.
 *
 * The API prices everything in the canonical currency (TZS) and says so in
 * `price.currency`. Display currency is a presentation concern handled here
 * and nowhere else — no component performs its own conversion arithmetic.
 */

export type CurrencyCode = "TZS" | "USD";

/** Rates expressed as "1 TZS = X target", mirroring config/money.php. */
const RATES: Record<CurrencyCode, number> = {
  TZS: 1,
  USD: 0.000387,
};

const FRACTION_DIGITS: Record<CurrencyCode, number> = {
  TZS: 0, // Shilling amounts are quoted whole; decimals are noise.
  USD: 2,
};

export function convert(baseAmount: number, to: CurrencyCode): number {
  return baseAmount * (RATES[to] ?? 1);
}

/** `TZS 45,000` / `$17.41` — the canonical way to render a price. */
export function formatMoney(
  baseAmount: number | null | undefined,
  currency: CurrencyCode = BRAND.currency as CurrencyCode
): string {
  if (baseAmount === null || baseAmount === undefined || Number.isNaN(baseAmount)) {
    return "";
  }

  const value = convert(baseAmount, currency);
  const digits = FRACTION_DIGITS[currency] ?? 0;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return currency === "USD" ? `$${formatted}` : `${currency} ${formatted}`;
}

/** Amount without the currency label, for tight card layouts. */
export function formatAmount(
  baseAmount: number | null | undefined,
  currency: CurrencyCode = BRAND.currency as CurrencyCode
): string {
  if (baseAmount === null || baseAmount === undefined) return "";
  const digits = FRACTION_DIGITS[currency] ?? 0;
  return convert(baseAmount, currency).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return String(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
