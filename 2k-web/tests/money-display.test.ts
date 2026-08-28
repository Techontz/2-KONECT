import { describe, expect, it } from "vitest";

import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatCurrencyAmount,
  getActiveCurrency,
} from "@/lib/currency";

/**
 * There is one marketplace currency, and no way to change it.
 *
 * These used to test a currency switcher. The switcher is gone: 2KONECT
 * prices in shillings and shows shillings, so a shelf price no longer depends
 * on an exchange rate being right. That dependency is what made a mistyped
 * rate reprice the entire catalogue, twice.
 *
 * What remains testable is that nothing converts, nothing can be switched,
 * and a stored figure reaches the screen unchanged.
 */

describe("the marketplace currency", () => {
  it("is shillings", () => {
    expect(DEFAULT_CURRENCY).toBe("TZS");
    expect(getActiveCurrency()).toBe("TZS");
  });

  it("cannot be changed — there is no setter to call", async () => {
    const currency = await import("@/lib/currency");

    // A customer cannot select USD because nothing exists to select it with.
    for (const gone of ["setActiveCurrency", "writeStoredCurrency", "readStoredCurrency", "CURRENCY_HEADER"]) {
      expect(currency).not.toHaveProperty(gone);
    }
  });

  it("has no store or switcher left to mount", async () => {
    const { existsSync } = await import("node:fs");

    // Checked on disk rather than by import, because TypeScript already
    // refuses to resolve them — which is the same proof, one layer earlier.
    expect(existsSync("lib/store/currency.tsx")).toBe(false);
    expect(existsSync("components/layout/CurrencySwitcher.tsx")).toBe(false);
  });

  it("is not requested from the API by any header", async () => {
    const { readFileSync } = await import("node:fs");

    // The storefront no longer tells the server which currency it wants.
    expect(readFileSync("lib/api.ts", "utf8")).not.toContain("X-Currency");
  });
});

describe("a stored price reaches the screen unchanged", () => {
  // The three figures from the incident reports.
  it.each([
    [7000, "TZS 7,000"],
    [2500000, "TZS 2,500,000"],
    [2700000, "TZS 2,700,000"],
    [50000, "TZS 50,000"],
  ])("%i renders as %s", (stored, expected) => {
    expect(formatCurrency(stored)).toBe(expected);
  });

  it("never renders a shilling amount with a dollar sign", () => {
    for (const stored of [7000, 2500000, 2700000]) {
      const rendered = formatCurrency(stored);
      expect(rendered).not.toContain("$");
      expect(rendered).toContain("TZS");
    }
  });

  it("never renders a converted figure", () => {
    // 7000 at any rate anyone has typed. None of these may appear.
    for (const converted of ["2.50", "2.80", "1,080", "964.29", "892.86"]) {
      expect(formatCurrency(7000)).not.toContain(converted);
    }
  });

  it("does not put decimals on shillings", () => {
    expect(formatCurrency(7000)).toBe("TZS 7,000");
    expect(formatCurrency(49999.83)).toBe("TZS 50,000");
  });
});

describe("formatting is still safe at the edges", () => {
  it("renders nothing rather than NaN", () => {
    for (const bad of [null, undefined, NaN]) {
      expect(formatCurrency(bad as number | null | undefined)).toBe("");
    }
  });

  it("handles zero, large amounts and refunds", () => {
    expect(formatCurrency(0)).toBe("TZS 0");
    expect(formatCurrency(12500000)).toBe("TZS 12,500,000");
    expect(formatCurrency(-50000)).toBe("-TZS 50,000");
  });

  it("renders a bare amount where the label is elsewhere", () => {
    expect(formatCurrencyAmount(50000)).toBe("50,000");
  });
});

/**
 * An order agreed in another currency before the switcher was removed still
 * renders from its own snapshot. That is why formatCurrency still accepts a
 * currency at all — it is for history, not for choice.
 */
describe("historical orders", () => {
  it("still render in the currency they were agreed in", () => {
    expect(formatCurrency(40, "USD")).toBe("$40.00");
    expect(formatCurrency(100000, "TZS")).toBe("TZS 100,000");
  });
});
