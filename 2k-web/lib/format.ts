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

/**
 * `250K` / `2.5M` — an amount short enough to sit on a filter chip, without
 * the currency label.
 *
 * Chips carry a ladder of round numbers, so the compact form is exact rather
 * than an approximation: 2,500,000 renders as `2.5M`. Anything that would need
 * more than one decimal to stay truthful keeps its full digits instead of
 * being rounded into a number the catalogue does not contain.
 */
export function compactAmount(
  baseAmount: number,
  currency: CurrencyCode = BRAND.currency as CurrencyCode
): string {
  const value = convert(baseAmount, currency);

  const unit =
    value >= 1_000_000 ? { divisor: 1_000_000, suffix: "M" }
    : value >= 1_000 ? { divisor: 1_000, suffix: "K" }
    : null;

  if (!unit) return formatAmount(baseAmount, currency);

  const scaled = value / unit.divisor;
  const rounded = Math.round(scaled * 10) / 10;
  // Falling back to the full number keeps the chip honest when rounding would
  // misstate the cap the shopper is actually applying.
  if (Math.abs(rounded * unit.divisor - value) > 0.5) {
    return formatAmount(baseAmount, currency);
  }

  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${unit.suffix}`;
}

/** `TZS 250K` — the compact amount with its currency, for prose and labels. */
export function formatCompactMoney(
  baseAmount: number,
  currency: CurrencyCode = BRAND.currency as CurrencyCode
): string {
  const compact = compactAmount(baseAmount, currency);
  return currency === "USD" ? `$${compact}` : `${currency} ${compact}`;
}

/** Digits only, as the shopper would type them: `1500000` -> `1,500,000`. */
export function groupDigits(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
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
