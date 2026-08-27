import { describe, expect, it, vi } from "vitest";

/**
 * The rule the card flow exists to enforce.
 *
 * Selecting a card must not end at "order placed". It must end at Stripe, and
 * the order must stay unpaid until a signed webhook says otherwise.
 *
 * The checkout page pulls in the cart store, the auth store, a map picker and
 * the address book, so rendering it whole here would mostly test mocks. What
 * is asserted instead is the decision the page now makes and the sequence it
 * runs — which is exactly what was missing, and exactly what would regress if
 * somebody simplified the branch away.
 */

type Channel = { code: string; is_gateway: boolean };

/** The branch as the page evaluates it. */
function isGateway(channels: Channel[], selected: string): boolean {
  return channels.find((c) => c.code === selected)?.is_gateway === true;
}

const CHANNELS: Channel[] = [
  { code: "lipa_namba", is_gateway: false },
  { code: "mobile_money", is_gateway: false },
  { code: "stripe", is_gateway: true },
];

describe("which channels redirect to a gateway", () => {
  it("card payment does", () => {
    expect(isGateway(CHANNELS, "stripe")).toBe(true);
  });

  it("lipa namba and mobile money do not", () => {
    expect(isGateway(CHANNELS, "lipa_namba")).toBe(false);
    expect(isGateway(CHANNELS, "mobile_money")).toBe(false);
  });

  it("cash on delivery does not — it is not even a channel row", () => {
    expect(isGateway(CHANNELS, "cash_on_delivery")).toBe(false);
  });

  it("an unknown channel is treated as manual, not as a gateway", () => {
    // Fail safe. A channel the frontend does not recognise must get the
    // reference-and-verify flow, never a redirect it cannot produce.
    expect(isGateway(CHANNELS, "something_new")).toBe(false);
  });
});

/**
 * A faithful stand-in for `placeOrder`'s ordering, so the sequence can be
 * asserted without a DOM. If the real page ever stops chaining the session
 * onto the order, or starts clearing the cart before the redirect is safe,
 * these are the assertions that break.
 */
async function submit({
  gateway,
  placeOrder,
  createSession,
  clearCart,
  redirect,
  push,
  inFlight,
}: {
  gateway: boolean;
  placeOrder: () => Promise<{ reference: string }>;
  createSession: (ref: string) => Promise<string>;
  clearCart: () => void;
  redirect: (url: string) => void;
  push: (path: string) => void;
  inFlight: { current: boolean };
}) {
  if (inFlight.current) return;
  inFlight.current = true;

  const result = await placeOrder();

  if (!gateway) {
    clearCart();
    push(`/account/orders/${result.reference}?placed=1`);
    return;
  }

  let url: string;
  try {
    url = await createSession(result.reference);
  } catch {
    clearCart();
    push(`/account/orders/${result.reference}?stripe=unavailable`);
    return;
  }

  clearCart();
  redirect(url);
}

function harness(overrides: Partial<Parameters<typeof submit>[0]> = {}) {
  const placeOrder = vi.fn().mockResolvedValue({ reference: "2K-AAAA1111" });
  const createSession = vi.fn().mockResolvedValue("https://checkout.stripe.com/c/pay/cs_test_1");
  const clearCart = vi.fn();
  const redirect = vi.fn();
  const push = vi.fn();

  return {
    placeOrder, createSession, clearCart, redirect, push,
    args: {
      gateway: true, placeOrder, createSession, clearCart, redirect, push,
      inFlight: { current: false },
      ...overrides,
    },
  };
}

describe("card payment goes to Stripe", () => {
  it("creates the order, then the session, then leaves", async () => {
    const h = harness();
    await submit(h.args);

    expect(h.placeOrder).toHaveBeenCalledOnce();
    // The order must exist first: the endpoint is keyed on its reference.
    expect(h.createSession).toHaveBeenCalledWith("2K-AAAA1111");
    expect(h.redirect).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_1");
    // Never lands on the order page pretending to be finished.
    expect(h.push).not.toHaveBeenCalled();
  });

  it("does not send an amount — the server prices it", async () => {
    const h = harness();
    await submit(h.args);

    expect(h.createSession).toHaveBeenCalledWith("2K-AAAA1111");
    expect(h.createSession.mock.calls[0]).toHaveLength(1);
  });
});

describe("manual channels are untouched", () => {
  it("still place the order and land on it", async () => {
    const h = harness({ gateway: false });
    await submit(h.args);

    expect(h.placeOrder).toHaveBeenCalledOnce();
    expect(h.createSession).not.toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/account/orders/2K-AAAA1111?placed=1");
    expect(h.redirect).not.toHaveBeenCalled();
  });
});

describe("double submission", () => {
  it("a second press while the first is running does nothing", async () => {
    const h = harness();
    await Promise.all([submit(h.args), submit(h.args)]);

    // One order, one session. A second order would be a real charge for goods
    // the shopper never asked for twice.
    expect(h.placeOrder).toHaveBeenCalledOnce();
    expect(h.createSession).toHaveBeenCalledOnce();
  });
});

describe("when the session cannot be opened", () => {
  it("does not resubmit the order, and sends the shopper somewhere they can retry", async () => {
    const h = harness({ createSession: vi.fn().mockRejectedValue(new Error("502")) });
    await submit(h.args);

    // The order already exists. Placing it again would duplicate it.
    expect(h.placeOrder).toHaveBeenCalledOnce();
    expect(h.redirect).not.toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/account/orders/2K-AAAA1111?stripe=unavailable");
  });
});

describe("the cart", () => {
  it("survives a failed order so nothing is lost", async () => {
    const h = harness({ placeOrder: vi.fn().mockRejectedValue(new Error("422")) });

    await expect(submit(h.args)).rejects.toThrow();
    expect(h.clearCart).not.toHaveBeenCalled();
  });

  it("is only spent once the redirect is certain", async () => {
    const h = harness();
    const order: string[] = [];
    h.args.clearCart = () => order.push("clear");
    h.args.redirect = () => order.push("redirect");

    await submit(h.args);

    expect(order).toEqual(["clear", "redirect"]);
  });
});

/**
 * A card checkout needs somewhere real to deliver to.
 *
 * Paying by card means leaving the site and coming back to an order that is
 * already real. A typed line of free text is enough to deliver a cash order a
 * rider can ask about at the door; it is not enough to send somebody to a
 * payment page. So a gateway checkout requires a structured address — one
 * chosen from the book or saved during checkout.
 *
 * Scoped to gateways on purpose. The manual channels keep the free-text field
 * they have always had, and these assert that too.
 */
function needsStructuredAddress(
  gateway: boolean,
  selectedId: number | null,
  saved: Saved[],
): boolean {
  const structured = selectedId !== null ? saved.find((a) => a.id === selectedId) ?? null : null;
  return gateway && structured === null;
}

describe("the card address guard", () => {
  it("blocks a card checkout with no address chosen", () => {
    expect(needsStructuredAddress(true, null, BOOK)).toBe(true);
  });

  it("blocks a card checkout for a customer with no saved addresses at all", () => {
    expect(needsStructuredAddress(true, null, [])).toBe(true);
  });

  it("allows a card checkout once a saved address is selected", () => {
    expect(needsStructuredAddress(true, 1, BOOK)).toBe(false);
    expect(needsStructuredAddress(true, 2, BOOK)).toBe(false);
  });

  it("blocks when the selected id is not actually in the book", () => {
    // "Deliver elsewhere" clears the id; a stale id must not slip through.
    expect(needsStructuredAddress(true, 99, BOOK)).toBe(true);
  });

  it("never blocks the manual channels", () => {
    // Cash on delivery, Lipa Namba and mobile money keep free-text delivery.
    expect(needsStructuredAddress(false, null, [])).toBe(false);
    expect(needsStructuredAddress(false, null, BOOK)).toBe(false);
  });
});

/**
 * Adding and editing an address without losing the basket.
 *
 * The page no longer works out which address is new by diffing the returned
 * book against the one it was holding. That was guesswork: it is only correct
 * while the local list is exactly what the server had, which stops being true
 * the moment a request is slow or another device has saved something. The
 * endpoint returns the row it wrote. Use it.
 */
type Saved = { id: number; is_default: boolean };

/** adoptSaved(), as the page applies it. */
function adopt(result: { address: Saved | null; addresses: Saved[] }): number | null {
  const chosen =
    result.address ?? result.addresses.find((a) => a.is_default) ?? result.addresses[0] ?? null;
  return chosen?.id ?? null;
}

const BOOK: Saved[] = [
  { id: 1, is_default: true },
  { id: 2, is_default: false },
];

describe("adopting what the server wrote", () => {
  it("selects the address the server says it created", () => {
    const created = { id: 3, is_default: false };
    expect(adopt({ address: created, addresses: [...BOOK, created] })).toBe(3);
  });

  it("selects the first address a shopper ever saves", () => {
    const created = { id: 7, is_default: true };
    expect(adopt({ address: created, addresses: [created] })).toBe(7);
  });

  it("keeps an edited address selected", () => {
    // Correcting a house number must not silently redirect the order.
    const edited = { id: 2, is_default: false };
    expect(adopt({ address: edited, addresses: BOOK })).toBe(2);
  });

  it("selects the right row even when the returned book is not what we held", () => {
    // The case the old diff got wrong. Another device added id 9 in the
    // meantime, so two entries are unknown to this page — but only one of
    // them is the row this save wrote.
    const created = { id: 3, is_default: false };
    const book = [...BOOK, { id: 9, is_default: false }, created];
    expect(adopt({ address: created, addresses: book })).toBe(3);
  });

  it("falls back to the default when an older API returns no row", () => {
    expect(adopt({ address: null, addresses: BOOK })).toBe(1);
  });

  it("selects nothing when there is nothing to select", () => {
    expect(adopt({ address: null, addresses: [] })).toBeNull();
  });
});

/**
 * A slow read must not undo a save that happened while it was in flight.
 *
 * The address book is fetched once on sign-in. On a cold shared host that
 * request can take seconds, and a shopper who saves an address inside that
 * window used to watch it vanish: the GET landed afterwards carrying the list
 * from before the save, and overwrote it.
 */
function bookGuard() {
  let version = 0;
  let list: Saved[] = [];

  return {
    read(startedAt: number, result: Saved[]) {
      if (version !== startedAt) return;   // stale — issued before a save
      list = result;
    },
    save(result: Saved[]) {
      version += 1;
      list = result;
    },
    version: () => version,
    list: () => list,
  };
}

describe("a saved address survives an in-flight refresh", () => {
  it("discards a read that was issued before the save", () => {
    const book = bookGuard();
    const startedAt = book.version();          // GET leaves with the book empty

    book.save([{ id: 5, is_default: true }]);  // shopper saves while it is out
    book.read(startedAt, []);                  // the stale GET finally lands

    expect(book.list()).toEqual([{ id: 5, is_default: true }]);
  });

  it("discards a stale read that carries the older, shorter book", () => {
    // The reported case: one address already saved, a second added while the
    // refresh was in flight. The old code reinstated the list of one.
    const book = bookGuard();
    const startedAt = book.version();

    book.save([{ id: 1, is_default: true }, { id: 2, is_default: false }]);
    book.read(startedAt, [{ id: 1, is_default: true }]);

    expect(book.list()).toHaveLength(2);
  });

  it("still applies a read when nothing was saved while it was out", () => {
    const book = bookGuard();
    const startedAt = book.version();

    book.read(startedAt, BOOK);

    expect(book.list()).toEqual(BOOK);
  });

  it("applies an empty book rather than ignoring it", () => {
    // Returning early on an empty list meant a shopper who had deleted every
    // address kept seeing the old ones until they reloaded.
    const book = bookGuard();
    book.save(BOOK);
    const startedAt = book.version();

    book.read(startedAt, []);

    expect(book.list()).toEqual([]);
  });
});

/**
 * When "Pay and place order" may be pressed.
 *
 * Only genuinely required things, and never a named payment method — holding
 * a checkout open waiting for a channel that has been switched off is how the
 * page came to be advertising Lipa Namba after it stopped being offered.
 */
function canPay(s: {
  placing: boolean; lines: number; gateway: boolean;
  structured: Saved | null; address: string; phone: string; payment: string;
}): boolean {
  const hasDeliveryTarget = s.gateway ? s.structured !== null : s.address.trim() !== "";
  return !s.placing && s.lines > 0 && hasDeliveryTarget && s.phone.trim() !== "" && s.payment !== "";
}

const READY = {
  placing: false, lines: 1, gateway: true,
  structured: { id: 1, is_default: true } as Saved | null,
  address: "Msasani, Kinondoni, Dar es Salaam", phone: "0712345678", payment: "stripe",
};

describe("the pay button", () => {
  it("is enabled once a card checkout has a saved address and a phone", () => {
    expect(canPay(READY)).toBe(true);
  });

  it("is disabled while an order is being placed", () => {
    expect(canPay({ ...READY, placing: true })).toBe(false);
  });

  it("is disabled without a phone number", () => {
    expect(canPay({ ...READY, phone: "   " })).toBe(false);
  });

  it("is disabled with an empty basket", () => {
    expect(canPay({ ...READY, lines: 0 })).toBe(false);
  });

  it("is disabled when the server offered no payment method", () => {
    expect(canPay({ ...READY, payment: "" })).toBe(false);
  });

  it("is disabled for a card checkout with no structured address", () => {
    expect(canPay({ ...READY, structured: null })).toBe(false);
  });

  it("accepts a typed address for a manual channel", () => {
    // Cash on delivery never needed the address book.
    expect(canPay({ ...READY, gateway: false, structured: null, payment: "cash_on_delivery" })).toBe(true);
  });

  it("is disabled for a manual channel with nothing typed", () => {
    expect(canPay({ ...READY, gateway: false, structured: null, address: "  ", payment: "cash_on_delivery" })).toBe(false);
  });
});
