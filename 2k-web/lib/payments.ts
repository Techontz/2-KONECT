import api from "./api";

/**
 * How a customer may pay 2KONECT, read from the server.
 *
 * The till number is deliberately not in this repository. It changes without a
 * deployment, an administrator owns it, and a number compiled into a bundle is
 * a number that is wrong the day it changes — and wrong in a way that sends
 * real money to somebody else.
 */
export interface PaymentChannel {
  code: string;
  label: string;
  merchant_name: string | null;
  number: string | null;
  instructions: string | null;
  requires_reference: boolean;
  requires_verification: boolean;
}

export interface PaymentOptions {
  /** True when the basket holds anything sourced from abroad. */
  requires_prepayment: boolean;
  /** Whether cash on delivery may be offered at all. */
  cash_on_delivery: boolean;
  /** Whether a delivery fee belongs on this checkout. */
  charges_delivery: boolean;
  channels: PaymentChannel[];
}

/**
 * What this basket may be paid with.
 *
 * `hasImport` is a hint so the page can render the right thing immediately; it
 * is not a permission. The same rule is applied again on the server against
 * the real products when the order is placed, so a client that lies about it
 * gets a refusal rather than cash on delivery.
 */
export async function paymentOptions(hasImport: boolean): Promise<PaymentOptions> {
  const { data } = await api.get<PaymentOptions>("/shop/payment-channels", {
    params: hasImport ? { import: 1 } : undefined,
  });
  return data;
}

/** Tell 2KONECT the money has been sent. Never marks the order paid. */
export async function submitPaymentReference(
  reference: string,
  paymentReference: string,
): Promise<void> {
  await api.post(`/shop/orders/${encodeURIComponent(reference)}/payment`, {
    payment_reference: paymentReference,
  });
}

/** Where an order stands with money, as the customer should read it. */
export type PaymentStatus =
  | "not_required"
  | "awaiting_payment"
  | "awaiting_verification"
  | "verified"
  | "rejected";
