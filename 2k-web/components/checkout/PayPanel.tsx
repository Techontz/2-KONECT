"use client";

import { useEffect, useState } from "react";

import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/api";
import {
  createCheckoutSession,
  paymentOptions,
  submitPaymentReference,
  type PaymentChannel,
  type PaymentStatus,
} from "@/lib/payments";
import { Button, Notice } from "@/components/ui/Primitives";
import { CopyValue } from "./CopyValue";

/**
 * Paying for an order that was placed but not yet settled.
 *
 * Lives on the order page rather than inside checkout on purpose. An order
 * paid by hand is not finished when the form is submitted — the shopper leaves
 * to open their banking app, comes back, and may return again days later to
 * see whether it was accepted. The order is the thing that persists, so the
 * place to pay is the order.
 *
 * It never claims an order is paid. Submitting a reference moves it into a
 * queue that a person works; the only state this component can produce is
 * "waiting to be checked".
 */
export function PayPanel({
  reference,
  amount,
  method,
  status,
  onSubmitted,
}: {
  /** The order reference. */
  reference: string;
  /** What is owed, in the base currency. */
  amount: number;
  /** The channel code chosen at checkout. */
  method: string | null;
  status: PaymentStatus;
  onSubmitted?: () => void;
}) {
  const t = useT();

  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The till number is fetched, never bundled. See lib/payments.ts.
  //
  // The prepaid set is requested because this panel only ever renders for an
  // order that owes money — a cash-on-delivery order returns null above. That
  // set contains every channel except cash on delivery, so whichever one the
  // order was placed with is in it.
  useEffect(() => {
    let live = true;

    paymentOptions(true)
      .then((options) => {
        if (!live) return;
        setChannel(options.channels.find((c) => c.code === method) ?? options.channels[0] ?? null);
      })
      .catch(() => undefined);

    return () => { live = false; };
  }, [method]);

  // Nothing is owed on a cash-on-delivery order, and a settled one is done.
  if (status === "not_required" || status === "verified") return null;

  // A gateway confirms itself. There is no number to copy, no reference to
  // type and nobody to wait for — the shopper goes and pays, and a signed
  // webhook settles the order. So this is a different panel, not the same one
  // with fields hidden.
  if (channel?.is_gateway) {
    return (
      <GatewayPanel
        reference={reference}
        amount={amount}
        channel={channel}
        status={status}
      />
    );
  }

  const waiting = status === "awaiting_verification" || done;

  if (waiting) {
    return (
      <section className="rounded-[var(--radius-md)] border border-[color:var(--color-warn-line,#e6c200)] bg-[color:var(--color-warn-soft,#fff8e1)] p-4">
        <p className="text-[15px] font-black">{t("payment.statusPendingVerification")}</p>
        <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
          {t("payment.pendingVerificationHint")}
        </p>
      </section>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const entered = value.trim();
    if (entered.length < 4) {
      setError(t("payment.referenceTooShort"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await submitPaymentReference(reference, entered);
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(apiError(err, t("payment.submitFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-surface)]">
      <header className="brand-ground px-4 py-3">
        <p className="text-[15px] font-black text-white">
          {t("payment.payWith", { method: channel?.label ?? t("payment.lipaNamba") })}
        </p>
      </header>

      {status === "rejected" ? (
        <Notice tone="danger" className="m-4 mb-0">{t("payment.rejectedHint")}</Notice>
      ) : null}

      <div className="space-y-3 p-4">
        {channel?.number ? (
          <>
            <CopyValue
              tone="brand"
              label={channel.label}
              value={channel.number}
            />
            {channel.merchant_name ? (
              <p className="-mt-1 text-[13px] font-bold text-[color:var(--color-ink-soft)]">
                {channel.merchant_name}
              </p>
            ) : null}
          </>
        ) : (
          // An administrator has not finished configuring a channel. Saying so
          // is better than showing a blank where a number should be.
          <Notice tone="warn">{t("payment.noChannels")}</Notice>
        )}

        <CopyValue
          label={t("payment.amountToPay")}
          value={String(Math.round(amount))}
          display={formatMoney(amount)}
        />

        {channel?.instructions ? (
          <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
            {channel.instructions}
          </p>
        ) : null}

        <form onSubmit={submit} className="border-t border-[color:var(--color-line)] pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            {t("payment.afterPaying")}
          </p>

          <label htmlFor="payment-reference" className="mt-2 block text-[13px] font-bold">
            {t("payment.paymentReference")}
          </label>
          <input
            id="payment-reference"
            value={value}
            onChange={(event) => { setValue(event.target.value); setError(null); }}
            placeholder={t("payment.referencePlaceholder")}
            autoComplete="off"
            aria-describedby="payment-reference-hint"
            className="mt-1 h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] font-bold uppercase tracking-wide outline-none focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand-200)]"
          />
          <p id="payment-reference-hint" className="mt-1 text-[12px] text-[color:var(--color-ink-muted)]">
            {t("payment.referenceHint")}
          </p>

          {error ? <Notice tone="danger" className="mt-2">{error}</Notice> : null}

          <Button type="submit" size="lg" className="mt-3 w-full" loading={busy} disabled={!channel?.number}>
            {busy ? t("payment.submitting") : t("payment.iHavePaid")}
          </Button>
        </form>
      </div>
    </section>
  );
}

/**
 * Paying by card.
 *
 * One button. It asks the server for a Checkout Session and leaves — the URL
 * is the only thing the server hands back, and the amount was decided there
 * from the order's own rows.
 *
 * Deliberately says nothing about whether the order is paid. Coming back from
 * Stripe is not evidence of anything; the order page refetches and shows
 * whatever the webhook has actually recorded.
 */
function GatewayPanel({
  reference,
  amount,
  channel,
  status,
}: {
  reference: string;
  amount: number;
  channel: PaymentChannel;
  status: PaymentStatus;
}) {
  const t = useT();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);

    try {
      const url = await createCheckoutSession(reference);
      // Leaves the site. `assign` rather than `replace` so the back button
      // still returns here if the shopper changes their mind on Stripe's page.
      window.location.assign(url);
    } catch (err) {
      setError(apiError(err, t("payment.submitFailed")));
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-surface)]">
      <header className="brand-ground px-4 py-3">
        <p className="text-[15px] font-black text-white">
          {t("payment.payWith", { method: channel.label })}
        </p>
      </header>

      <div className="space-y-3 p-4">
        {status === "rejected" ? (
          <Notice tone="danger">{t("payment.rejectedHint")}</Notice>
        ) : null}

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-[color:var(--color-ink-muted)]">
            {t("payment.amountToPay")}
          </span>
          <span className="text-[22px] font-black tracking-[-0.02em]">{formatMoney(amount)}</span>
        </div>

        {channel.instructions ? (
          <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
            {channel.instructions}
          </p>
        ) : null}

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Button type="button" size="lg" className="w-full" loading={busy} onClick={() => void pay()}>
          {busy ? t("payment.submitting") : t("payment.paySecurely")}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-[color:var(--color-ink-faint)]">
          {t("payment.gatewayNote")}
        </p>
      </div>
    </section>
  );
}
