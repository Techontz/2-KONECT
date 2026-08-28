import {
  type CurrencyCode,
  currencyDecimals,
  formatCurrency,
  formatCurrencyAmount,
  getActiveCurrency,
} from "./currency";

export type { CurrencyCode };

/**
 * Currency formatting for the storefront.
 *
 * ---- this file no longer converts anything ----
 *
 * It used to hold `RATES = { USD: 0.000387 }` — a second copy of a rate that
 * also lived in the backend, in a different direction, with no mechanism to
 * keep the two in step. Whichever drifted first would have shown a customer one
 * price on the product page and a different one in the basket.
 *
 * The API now sends prices already converted, in the currency the request asked
 * for, at the rate an administrator set. Every payload carries `currency` and
 * the canonical `base_current` beside it. So this file's whole job is putting a
 * symbol and the right number of digits around a figure the server computed.
 *
 * If you find yourself wanting to multiply by a rate here, the rate you want is
 * on the payload — and the fact that you need it means the server should have
 * done the sum.
 */

/**
 * Kept as an identity so no call site breaks, and deliberately does nothing.
 *
 * @deprecated The server converts. Read `price.current`, which is already in
 * `price.currency`.
 */
export function convert(amount: number, _to?: CurrencyCode): number {
  return amount;
}

/**
 * `TZS 50,000` / `$20.00` — the canonical way to render a price.
 *
 * The amount is already in the display currency: the server converted it, at
 * the rate an administrator set, before it ever reached the browser. This puts
 * a symbol and the right number of digits around it and does nothing else.
 *
 * Defaults to the *active* currency rather than a build-time constant, which
 * is what makes every existing call site currency-aware without any of them
 * having to know that currencies exist. It used to default to `BRAND.currency`
 * and multiply by a rate hardcoded in this file.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: CurrencyCode = getActiveCurrency(),
): string {
  return formatCurrency(amount, currency);
}

/** Amount without the currency label, for tight card layouts. */
export function formatAmount(
  amount: number | null | undefined,
  currency: CurrencyCode = getActiveCurrency(),
): string {
  return formatCurrencyAmount(amount, currency);
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
  currency: CurrencyCode = getActiveCurrency()
): string {
  const value = baseAmount;   // already in `currency`; the server converted it

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
  currency: CurrencyCode = getActiveCurrency()
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
