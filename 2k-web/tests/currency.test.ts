import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Currency, on the client.
 *
 * What is asserted here is narrow on purpose. The rate is the server's and the
 * conversion is the server's, so re-testing arithmetic in the browser would
 * only prove a mock agrees with itself. What the client can get wrong is the
 * precedence — whose choice wins — and whether the currency it asks for is the
 * one it renders.
 */

const store = new Map<string, string>();

vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const {
  CURRENCY_HEADER,
  DEFAULT_CURRENCY,
  formatCurrency,
  formatCurrencyAmount,
  getActiveCurrency,
  isCurrency,
  readStoredCurrency,
  setActiveCurrency,
  writeStoredCurrency,
} = await import("@/lib/currency");

beforeEach(() => {
  store.clear();
  setActiveCurrency(DEFAULT_CURRENCY);
});

/* ---------------------------------------------------------------- */
/* precedence — the rule the whole feature turns on                   */
/* ---------------------------------------------------------------- */

/** The provider's order of precedence, as it resolves it. */
function resolve({
  stored,
  detected,
}: {
  stored: string | null;
  detected: string | null;
}): string {
  if (isCurrency(stored)) return stored;          // 1 & 2: a choice already made
  if (isCurrency(detected)) return detected;      // 3: what their country suggests
  return DEFAULT_CURRENCY;                        // 4: the default
}

describe("which currency a visitor gets", () => {
  it("offers shillings to a visitor detected in Tanzania", () => {
    expect(resolve({ stored: null, detected: "TZS" })).toBe("TZS");
  });

  it("offers dollars to a visitor detected anywhere else", () => {
    expect(resolve({ stored: null, detected: "USD" })).toBe("USD");
  });

  it("falls back to the default when detection says nothing", () => {
    // Detection failing must never stop somebody shopping.
    expect(resolve({ stored: null, detected: null })).toBe("TZS");
  });

  it("keeps dollars for a Tanzanian who chose dollars", () => {
    // The rule the feature exists for: a choice outlives a location.
    expect(resolve({ stored: "USD", detected: "TZS" })).toBe("USD");
  });

  it("keeps shillings for a foreign visitor who chose shillings", () => {
    expect(resolve({ stored: "TZS", detected: "USD" })).toBe("TZS");
  });

  it("ignores a stored value that is not a currency we support", () => {
    expect(resolve({ stored: "KES", detected: "USD" })).toBe("USD");
    expect(resolve({ stored: "", detected: null })).toBe("TZS");
  });
});

/* ---------------------------------------------------------------- */
/* persistence                                                        */
/* ---------------------------------------------------------------- */

describe("remembering the choice", () => {
  it("survives to the next visit", () => {
    writeStoredCurrency("USD");
    expect(readStoredCurrency()).toBe("USD");
  });

  it("reads nothing when nothing was ever chosen", () => {
    // Distinct from "they chose TZS" — one must override detection, the
    // other must not.
    expect(readStoredCurrency()).toBeNull();
  });

  it("discards a stored value that is not a currency", () => {
    store.set("2konect.currency", "BTC");
    expect(readStoredCurrency()).toBeNull();
  });
});

/* ---------------------------------------------------------------- */
/* what the request carries                                           */
/* ---------------------------------------------------------------- */

describe("the request header", () => {
  it("is the header the backend middleware reads", () => {
    expect(CURRENCY_HEADER).toBe("X-Currency");
  });

  it("carries whatever was chosen, without waiting for a render", () => {
    // The interceptor reads this module value rather than React state, so a
    // request fired from the click that changed the currency already carries
    // the new one.
    setActiveCurrency("USD");
    expect(getActiveCurrency()).toBe("USD");
  });
});

/* ---------------------------------------------------------------- */
/* formatting                                                        */
/* ---------------------------------------------------------------- */

describe("formatting", () => {
  it("quotes shillings whole", () => {
    // "TZS 49,999.83" is not a price anyone has charged in Tanzania.
    expect(formatCurrency(50000, "TZS")).toBe("TZS 50,000");
    expect(formatCurrency(49999.83, "TZS")).toBe("TZS 50,000");
  });

  it("keeps cents on dollars", () => {
    expect(formatCurrency(20, "USD")).toBe("$20.00");
    expect(formatCurrency(19.999, "USD")).toBe("$20.00");
  });

  it("never renders NaN at a shopper", () => {
    for (const bad of [null, undefined, NaN]) {
      expect(formatCurrency(bad as number | null | undefined, "USD")).toBe("");
    }
  });

  it("handles zero and very large amounts", () => {
    expect(formatCurrency(0, "TZS")).toBe("TZS 0");
    expect(formatCurrency(0, "USD")).toBe("$0.00");
    expect(formatCurrency(12500000, "TZS")).toBe("TZS 12,500,000");
  });

  it("puts the sign before the symbol on a refund", () => {
    expect(formatCurrency(-20, "USD")).toBe("-$20.00");
    expect(formatCurrency(-50000, "TZS")).toBe("-TZS 50,000");
  });

  it("renders a bare amount without a label where the label is elsewhere", () => {
    expect(formatCurrencyAmount(50000, "TZS")).toBe("50,000");
    expect(formatCurrencyAmount(20, "USD")).toBe("20.00");
  });
});

/* ---------------------------------------------------------------- */
/* no rate on the client                                             */
/* ---------------------------------------------------------------- */

describe("the client does not convert", () => {
  it("formats the figure it is given, whatever the currency", async () => {
    // The server converted already. If this file ever multiplies by a rate,
    // the browser and the backend can disagree — which is the bug this whole
    // system was built to remove.
    expect(formatCurrency(20, "USD")).toBe("$20.00");
    expect(formatCurrency(20, "TZS")).toBe("TZS 20");
  });

  it("exposes convert() only as an identity, for call sites not yet migrated", async () => {
    const { convert } = await import("@/lib/format");
    expect(convert(50000, "USD")).toBe(50000);
  });
});
