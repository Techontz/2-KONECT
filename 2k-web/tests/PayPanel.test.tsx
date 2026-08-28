import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The payment panel, per channel.
 *
 * What may be paid, by whom and for how much is decided and tested on the
 * server; re-asserting it here would only prove a mock agrees with itself.
 * What these cover is the thing only the browser can get wrong: showing a
 * shopper the wrong payment surface for the channel they are actually on — a
 * till number to copy for a card payment, or a redirect button for a channel
 * that has no page to redirect to.
 *
 * The one security property asserted here is negative and important: nothing
 * in this component can mark an order paid, whatever the URL says.
 */

const paymentOptions = vi.fn();
const createCheckoutSession = vi.fn();
const submitPaymentReference = vi.fn();

vi.mock("@/lib/payments", () => ({
  paymentOptions: (...args: unknown[]) => paymentOptions(...args),
  createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
  submitPaymentReference: (...args: unknown[]) => submitPaymentReference(...args),
}));

// The dictionary is exercised by its own tooling; here the key is enough to
// assert which branch rendered without coupling to the wording.
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/api", () => ({ apiError: (_e: unknown, fallback: string) => fallback }));
vi.mock("@/lib/format", () => ({ formatMoney: (n: number) => `TZS ${n}` }));

const { PayPanel } = await import("@/components/checkout/PayPanel");

const gateway = {
  code: "stripe",
  label: "Card payment",
  merchant_name: null,
  number: null,
  instructions: "Pay securely by card.",
  requires_reference: false,
  requires_verification: false,
  is_gateway: true,
};

const manual = {
  code: "lipa_namba",
  label: "Lipa Namba",
  merchant_name: "2KONECT",
  number: "555123",
  instructions: "Pay the exact amount.",
  requires_reference: true,
  requires_verification: true,
  is_gateway: false,
};

function options(channels: unknown[]) {
  return {
    requires_prepayment: true,
    cash_on_delivery: false,
    charges_delivery: false,
    channels,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/c/pay/cs_test_1");
});

describe("a gateway channel", () => {
  beforeEach(() => paymentOptions.mockResolvedValue(options([gateway])));

  it("renders a redirect button rather than a reference form", async () => {
    render(<PayPanel reference="2K-AAAA1111" amount={103000} currency="TZS" method="stripe" status="awaiting_payment" />);

    await waitFor(() => expect(screen.getByText("payment.paySecurely")).toBeInTheDocument());

    // There is nothing to type: the gateway confirms itself.
    expect(screen.queryByLabelText("payment.paymentReference")).not.toBeInTheDocument();
    expect(screen.queryByText("payment.iHavePaid")).not.toBeInTheDocument();
  });

  it("shows no till number, because a gateway has none", async () => {
    render(<PayPanel reference="2K-AAAA1111" amount={103000} currency="TZS" method="stripe" status="awaiting_payment" />);

    await waitFor(() => expect(screen.getByText("payment.paySecurely")).toBeInTheDocument());

    expect(screen.queryByText("555123")).not.toBeInTheDocument();
  });

  it("does not create a session merely by rendering", async () => {
    render(<PayPanel reference="2K-AAAA1111" amount={103000} currency="TZS" method="stripe" status="awaiting_payment" />);

    await waitFor(() => expect(screen.getByText("payment.paySecurely")).toBeInTheDocument());

    // A payment starts when somebody asks for it, not when a page loads.
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("a manual channel is unchanged", () => {
  beforeEach(() => paymentOptions.mockResolvedValue(options([manual])));

  it("still shows the till number and the reference form", async () => {
    render(<PayPanel reference="2K-BBBB2222" amount={50000} currency="TZS" method="lipa_namba" status="awaiting_payment" />);

    await waitFor(() => expect(screen.getByText("555123")).toBeInTheDocument());

    expect(screen.getByText("payment.iHavePaid")).toBeInTheDocument();
    expect(screen.queryByText("payment.paySecurely")).not.toBeInTheDocument();
  });

  it("still shows the waiting state once a reference has been submitted", async () => {
    render(<PayPanel reference="2K-BBBB2222" amount={50000} currency="TZS" method="lipa_namba" status="awaiting_verification" />);

    await waitFor(() =>
      expect(screen.getByText("payment.statusPendingVerification")).toBeInTheDocument(),
    );
  });
});

describe("nothing here can settle an order", () => {
  it("renders nothing at all for an order the server says is verified", async () => {
    paymentOptions.mockResolvedValue(options([gateway]));

    const { container } = render(
      <PayPanel reference="2K-CCCC3333" amount={103000} currency="TZS" method="stripe" status="verified" />,
    );

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders nothing for a cash-on-delivery order", async () => {
    paymentOptions.mockResolvedValue(options([manual]));

    const { container } = render(
      <PayPanel reference="2K-DDDD4444" amount={50000} currency="TZS" method="cash_on_delivery" status="not_required" />,
    );

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("still asks to be paid when the URL claims success but the order does not", async () => {
    // The decisive case. `?stripe=success` is a string a shopper can type, and
    // a shopper who really paid may never send it at all. The panel renders
    // from the status the server returned and from nothing else — so a forged
    // return lands on a page that still says the order is unpaid.
    paymentOptions.mockResolvedValue(options([gateway]));
    window.history.pushState({}, "", "/account/orders/2K-EEEE5555/?stripe=success");

    render(<PayPanel reference="2K-EEEE5555" amount={103000} currency="TZS" method="stripe" status="awaiting_payment" />);

    await waitFor(() => expect(screen.getByText("payment.paySecurely")).toBeInTheDocument());
  });
});
