import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_CURRENCY,
  formatCurrency,
  setActiveCurrency,
} from "@/lib/currency";

/**
 * A number and a symbol must describe the same currency.
 *
 * They stopped doing so. `formatMoney(amount)` was changed to default to the
 * *display* currency, which made every call site currency-aware in one line —
 * and silently mislabelled every amount that had not been converted. Product
 * prices were fine, because the server converts those. Order and seller
 * amounts were not: they arrive as canonical shillings, so a TZS 7,000 order
 * rendered as "$7,000.00" to anybody browsing in dollars.
 *
 * The fix is that an amount now travels with its currency and every call site
 * that renders one names it. These are the arithmetic and formatting facts
 * that fix depends on.
 */

beforeEach(() => setActiveCurrency(DEFAULT_CURRENCY));

/** What the server does. Reproduced here only to pin the expected figures. */
const RATE = 2500;
const toUsd = (tzs: number) => Math.round((tzs / RATE) * 100) / 100;

describe("the reported bug", () => {
  it("never renders a shilling amount with a dollar sign", () => {
    // The exact case from production: base TZS 7,000.
    expect(formatCurrency(7000, "TZS")).toBe("TZS 7,000");
    expect(formatCurrency(7000, "TZS")).not.toContain("$");
  });

  it("shows TZS 7,000 as $2.80 once it has actually been converted", () => {
    expect(toUsd(7000)).toBe(2.8);
    expect(formatCurrency(toUsd(7000), "USD")).toBe("$2.80");
  });

  it("does not put decimals on shillings", () => {
    expect(formatCurrency(7000, "TZS")).not.toBe("TZS 7,000.00");
  });
});

describe("the products named in the report", () => {
  it("Large Hard-Shell Travel Suitcase — TZS 7,000", () => {
    expect(formatCurrency(7000, "TZS")).toBe("TZS 7,000");
    expect(formatCurrency(toUsd(7000), "USD")).toBe("$2.80");
  });

  it("iPhone 17 Pro Max 256GB — TZS 2,700,000", () => {
    expect(formatCurrency(2700000, "TZS")).toBe("TZS 2,700,000");
    expect(toUsd(2700000)).toBe(1080);
    expect(formatCurrency(toUsd(2700000), "USD")).toBe("$1,080.00");
  });

  it("iPhone 17 Pro Max — TZS 2,500,000", () => {
    expect(formatCurrency(2500000, "TZS")).toBe("TZS 2,500,000");
    expect(toUsd(2500000)).toBe(1000);
    expect(formatCurrency(toUsd(2500000), "USD")).toBe("$1,000.00");
  });
});

/**
 * An order carries its own currency, from the snapshot taken when it was
 * placed. It does not follow the reader's preference and it does not follow
 * the rate.
 */
type Order = { total: number; currency: "TZS" | "USD"; exchange_rate: number | null };

const render = (order: Order) => formatCurrency(order.total, order.currency);

describe("an order is rendered in its own currency", () => {
  it("a shilling order reads as shillings even while browsing in dollars", () => {
    setActiveCurrency("USD");

    expect(render({ total: 7000, currency: "TZS", exchange_rate: null })).toBe("TZS 7,000");
  });

  it("a dollar order reads as dollars even while browsing in shillings", () => {
    setActiveCurrency("TZS");

    expect(render({ total: 2.8, currency: "USD", exchange_rate: 2500 })).toBe("$2.80");
  });

  it("is unmoved when the administrator changes the rate", () => {
    // The order was converted once, at 2,500, and written down. Nothing here
    // divides by anything, which is precisely why a later rate cannot reach it.
    const order: Order = { total: 2.8, currency: "USD", exchange_rate: 2500 };

    expect(render(order)).toBe("$2.80");
    // Rate moves to 2,700 — the order is not recomputed, so it does not move.
    expect(render(order)).toBe("$2.80");
    expect(order.total).toBe(2.8);
  });
});

describe("seller amounts", () => {
  it("are shillings, whatever the seller is browsing in", () => {
    setActiveCurrency("USD");

    // A seller is paid in shillings; the console says shillings.
    expect(formatCurrency(7000, "TZS")).toBe("TZS 7,000");
    expect(formatCurrency(450000, "TZS")).toBe("TZS 450,000");
  });
});

describe("switching currency changes nothing but the rendering", () => {
  it("leaves the stored amount alone", () => {
    const price = { base_current: 7000, current: 2.8, currency: "USD" as const };

    setActiveCurrency("TZS");
    setActiveCurrency("USD");
    setActiveCurrency("TZS");

    // The canonical figure is the seller's and is never touched by a display
    // preference.
    expect(price.base_current).toBe(7000);
  });
});

describe("there is no rate in the browser", () => {
  it("formatting never converts", () => {
    // Same number in, two currencies out, no arithmetic. If this file ever
    // multiplies by a rate, the browser and the server can disagree.
    expect(formatCurrency(7000, "TZS")).toBe("TZS 7,000");
    expect(formatCurrency(7000, "USD")).toBe("$7,000.00");
  });
});
