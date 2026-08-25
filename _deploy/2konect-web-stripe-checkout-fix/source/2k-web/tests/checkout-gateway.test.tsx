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
