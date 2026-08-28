"use client";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { PayPanel } from "@/components/checkout/PayPanel";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import shop from "@/lib/shop";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { JourneyTimeline } from "@/components/sourcing/JourneyTimeline";
import { AvailabilityBadge, RouteLine } from "@/components/sourcing/Availability";
import { DeliveryRequestForm } from "@/components/delivery/DeliveryRequestForm";
import { Button, ButtonLink, EmptyState, Notice, Skeleton } from "@/components/ui/Primitives";

/**
 * One order, in full.
 *
 * The most important screen in the product after the product page: it is where
 * a buyer who has already paid finds out whether they were right to. So it
 * leads with the journey, states the promised date plainly, and — once an
 * imported shipment has landed — is where the last mile gets arranged.
 */
export default function OrderDetailPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-60 w-full" /></div>}>
        <OrderDetail />
      </Suspense>
    </SiteChrome>
  );
}

function OrderDetail() {
  const t = useT();
  const params = useParams<{ reference: string }>();
  const search = useSearchParams();
  const reference = decodeURIComponent(String(params.reference ?? ""));
  const justPlaced = search.get("placed") === "1";

  // Where the shopper came back from, and nothing more.
  //
  // `?stripe=success` is a hint that they finished on the payment page. It is
  // NOT evidence the money arrived: anybody can type it, and a shopper who
  // paid but closed the tab never sends it at all. The order is settled by a
  // signed webhook or not at all, so this only decides which sentence to show
  // while the real state is fetched.
  const returnedFromGateway = search.get("stripe");

  const { isAuthenticated, ready, requireAuth } = useAuth();

  const hydrated = useHydrated();

  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);

  const load = useCallback(() => {
    shop.order(reference).then(setOrder).catch(() => setMissing(true));
  }, [reference]);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { void requireAuth(); return; }
    load();
  }, [ready, isAuthenticated, requireAuth, load]);

  // Coming back from the payment page, the webhook may not have landed yet —
  // it is a separate request from Stripe to our server, racing the shopper's
  // browser. So the order is refetched a few times over the next half minute
  // rather than leaving somebody looking at a stale "awaiting payment" for an
  // order they have just paid for.
  //
  // This is a display convenience and nothing more. It polls; it never
  // decides. If the webhook never arrives the order stays unpaid, correctly.
  useEffect(() => {
    // Only after a completed attempt. A cancelled payment has nothing to
    // wait for, and neither does a session that never opened.
    if (returnedFromGateway !== "success" || !isAuthenticated) return;
    if (order?.payment_status === "verified") return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 10) { clearInterval(timer); return; }
      load();
    }, 3000);

    return () => clearInterval(timer);
  }, [returnedFromGateway, isAuthenticated, order?.payment_status, load]);

  if (hydrated && ready && !isAuthenticated) {
    return (
      <EmptyState
        title={t("orders.detailSignInTitle")}
        message={t("orders.detailSignInHint")}
        action={<Button size="lg" onClick={() => void requireAuth()}>{t("orders.signIn")}</Button>}
      />
    );
  }

  if (missing) {
    return (
      <EmptyState
        title={t("orders.notFound")}
        message={t("orders.notFoundHint", { reference })}
        action={<ButtonLink href="/account/orders">{t("orders.yourOrders")}</ButtonLink>}
      />
    );
  }

  if (!order) {
    return (
      <div className="shell space-y-3 py-4">
        <Skeleton className="h-24 w-full rounded-[var(--radius-md)]" />
        <Skeleton className="h-72 w-full rounded-[var(--radius-md)]" />
      </div>
    );
  }

  async function cancel() {
    if (!window.confirm(t("orders.cancelConfirmLong"))) return;

    setBusy(true);
    setError(null);
    try {
      await shop.cancelOrder(reference);
      load();
    } catch (err) {
      setError(apiError(err, t("orders.cancelFailed")));
    } finally {
      setBusy(false);
    }
  }

  const fulfilment = order.fulfilment;

  return (
    <div className="shell py-4 pb-tabbar">
      <nav aria-label={t("orders.breadcrumb")} className="mb-2 text-[12px] text-[color:var(--color-ink-muted)]">
        <Link href="/account/orders" prefetch={false} className="crumb hover:text-[color:var(--color-brand)]">
          {t("orders.backToOrders")}
        </Link>
      </nav>

      {/* Not a toast saying "success". A shopper who has just paid wants three
          things: confirmation it worked, when it arrives, and what happens
          next — so all three are on screen before anything else. */}
      {justPlaced ? <OrderConfirmation order={order} /> : null}

      {/* ---- header ---- */}
      <header className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              Order
            </p>
            <h1 className="text-[24px] font-black tracking-wide sm:text-[28px]">{order.reference}</h1>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-muted)]">
              Placed {formatDate(order.placed_at)} · {order.item_count}{" "}
              {order.item_count === 1 ? "item" : "items"}
            </p>

            {fulfilment && !fulfilment.is_local ? (
              <RouteLine
                from={fulfilment.origin}
                to={fulfilment.destination}
                className="mt-2 text-[color:var(--color-ink-soft)]"
              />
            ) : null}
          </div>

          <div className="text-right">
            <p className="text-[24px] font-black tracking-[-0.02em]">{formatMoney(order.total, order.currency)}</p>
            <p className="text-[12px] text-[color:var(--color-ink-muted)]">
              {order.payment_method === "cash_on_delivery"
                ? t("orders.cashOnDelivery")
                : paymentStatusLabel(order.payment_status, t)}
            </p>
          </div>
        </div>

        {/* The single most useful fact on the page, given its own line. */}
        {fulfilment?.estimated_arrival_at && order.status !== "completed" && order.status !== "cancelled" ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                {t("orders.estimatedArrival")}
              </p>
              <p className="text-[16px] font-black">{formatDate(fulfilment.estimated_arrival_at)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                Status
              </p>
              <p className="text-[16px] font-black">{order.status_label ?? order.status}</p>
            </div>
            {fulfilment.shipping_method ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                  Shipping
                </p>
                <p className="text-[16px] font-black">{fulfilment.shipping_method}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {order.can_request_delivery ? (
            <Button onClick={() => setDeliveryOpen(true)}>{t("orders.arrangeDeliveryBtn")}</Button>
          ) : null}
          {order.can_cancel ? (
            <Button variant="secondary" onClick={cancel} loading={busy}>
              {t("orders.cancel")}
            </Button>
          ) : null}
          <ButtonLink href="/account/messages" variant="ghost">{t("orders.needHelp")}</ButtonLink>
        </div>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Paying for an order that has not been settled. Renders nothing for
            cash on delivery or an order already verified. */}
        {/* ---- what came back from the payment page ----

            Every branch below reads `order.payment_status`, which is the
            server's word, and uses the query string only to choose the
            sentence. A shopper who types `?stripe=success` onto an unpaid
            order gets the "still waiting" panel, because the status says so.

            Equally, a shopper who paid and closed the tab never sends
            anything — and their order still settles, because the webhook
            does not need them to come back. */}

        {order.payment_status === "verified" && returnedFromGateway ? (
          <section className="lg:col-span-2 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-ok-line,#b7dfc4)] bg-[color:var(--color-ok-soft,#eaf7ee)] p-4">
            <p className="text-[17px] font-black text-[color:var(--color-ok,#1c7a3e)]">
              {t("payment.paymentSuccessful")}
            </p>
            <p className="mt-1 text-[13px]">{t("payment.paymentSuccessfulHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href="/shop" variant="ghost" size="sm">{t("payment.continueShopping")}</ButtonLink>
            </div>
          </section>
        ) : null}

        {returnedFromGateway === "success" && order.payment_status !== "verified" ? (
          <Notice tone="info" className="lg:col-span-2">
            <span className="block text-[15px] font-black">{t("payment.confirmingPayment")}</span>
            <span className="mt-1 block text-[13px]">{t("payment.confirmingPaymentHint")}</span>
          </Notice>
        ) : null}

        {returnedFromGateway === "cancelled" && order.payment_status !== "verified" ? (
          <Notice tone="warn" className="lg:col-span-2">
            <span className="block text-[15px] font-black">{t("payment.paymentCancelled")}</span>
            <span className="mt-1 block text-[13px]">{t("payment.paymentCancelledHint")}</span>
          </Notice>
        ) : null}

        {/* The session could not be opened at all — the order exists, unpaid.
            Distinct from a cancelled payment, because nothing was attempted. */}
        {returnedFromGateway === "unavailable" && order.payment_status !== "verified" ? (
          <Notice tone="warn" className="lg:col-span-2">
            <span className="block text-[15px] font-black">{t("payment.paymentUnavailable")}</span>
            <span className="mt-1 block text-[13px]">{t("payment.paymentUnavailableHint")}</span>
          </Notice>
        ) : null}

        {/* An administrator, or the gateway, could not confirm the money. */}
        {order.payment_status === "rejected" ? (
          <Notice tone="danger" className="lg:col-span-2">
            <span className="block text-[15px] font-black">{t("payment.paymentFailed")}</span>
            <span className="mt-1 block text-[13px]">
              {order.payment_note || t("payment.paymentFailedHint")}
            </span>
          </Notice>
        ) : null}

        {order.payment_method !== "cash_on_delivery" ? (
          <div className="lg:col-span-2">
            <PayPanel
              reference={order.reference}
              amount={order.total}
              currency={order.currency}
              method={order.payment_method}
              status={order.payment_status}
              onSubmitted={load}
            />
          </div>
        ) : null}

        {/* ---- the journey ---- */}
        <section className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <h2 className="px-4 pt-4 text-[16px] font-black">{t("orders.journey")}</h2>
          {fulfilment ? (
            <JourneyTimeline timeline={order.timeline} fulfilment={fulfilment} className="mt-1" />
          ) : null}
        </section>

        <div className="space-y-3">
          {/* ---- what was ordered ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-3 text-[16px] font-black">{t("orders.items")}</h2>
            <ul className="divide-y divide-[color:var(--color-line)]">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]">
                    {item.product?.image ? (
                      <img src={item.product.image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.product ? (
                      <Link
                        href={`/product?id=${item.product.id}`}
                        prefetch={false}
                        className="clamp-2 block text-[13px] font-semibold hover:underline"
                      >
                        {item.product.name}
                      </Link>
                    ) : (
                      <span className="text-[13px] italic text-[color:var(--color-ink-muted)]">
                        Product no longer listed
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {item.sourcing ? <AvailabilityBadge sourcing={item.sourcing} size="sm" /> : null}
                      <span className="text-[11px] text-[color:var(--color-ink-muted)]">Qty {item.quantity}</span>
                    </span>
                    {item.vendor ? (
                      <span className="mt-0.5 block text-[11px] text-[color:var(--color-ink-faint)]">
                        Sold by {item.vendor}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold">{formatMoney(item.total, order.currency)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1.5 border-t border-[color:var(--color-line)] pt-3 text-[13px]">
              <Row label={t("orders.subtotal")} value={formatMoney(order.subtotal, order.currency)} />
              {/* An imported order is quoted no delivery at checkout, so a
                  zero here is not "free" — it is "not decided yet". Saying
                  TZS 0 would promise a free delivery nobody has agreed to. */}
              <Row
                label={t("orders.delivery")}
                value={
                  order.delivery_fee > 0
                    ? formatMoney(order.delivery_fee, order.currency)
                    : order.fulfilment?.is_local === false
                      ? t("payment.deliveryNotAdded")
                      : formatMoney(0, order.currency)
                }
              />
              <div className="flex justify-between gap-3 border-t border-[color:var(--color-line)] pt-1.5">
                <dt className="font-black">{t("orders.total")}</dt>
                <dd className="text-[17px] font-black">{formatMoney(order.total, order.currency)}</dd>
              </div>
            </dl>
          </section>

          {/* ---- where it goes ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-2 text-[16px] font-black">{t("orders.delivery")}</h2>
            <dl className="space-y-2 text-[13px]">
              {order.delivery_address ? (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    {t("orders.address")}
                  </dt>
                  <dd className="mt-0.5 leading-relaxed">{order.delivery_address}</dd>
                </div>
              ) : null}
              {order.customer_phone ? (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    Phone
                  </dt>
                  <dd className="mt-0.5">{order.customer_phone}</dd>
                </div>
              ) : null}
              {fulfilment?.tracking_number ? (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    Tracking
                  </dt>
                  <dd className="mt-0.5 font-bold tracking-wide">
                    {fulfilment.carrier ? `${fulfilment.carrier} · ` : ""}{fulfilment.tracking_number}
                  </dd>
                </div>
              ) : null}
            </dl>

            {/* Last mile, once it has landed. */}
            {order.delivery_request ? (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                  2KONECT Rides · {order.delivery_request.status_label}
                </p>
                <p className="mt-1 text-[13px] font-bold">
                  {order.delivery_request.mode === "pickup"
                    ? `Collect from ${order.delivery_request.pickup_point}`
                    : `Delivery to ${order.delivery_request.address}`}
                </p>
                {/* Whatever the buyer actually asked for — a day, a window,
                    or neither. Falling back to "we will confirm" when they had
                    given us a preference reads as though it was ignored. */}
                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                  {[
                    order.delivery_request.preferred_date
                      ? formatDate(order.delivery_request.preferred_date)
                      : null,
                    order.delivery_request.preferred_window,
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("orders.confirmTime")}
                </p>
                {order.delivery_request.courier_name ? (
                  <p className="mt-1 text-[12px]">
                    {t("orders.rider")} <span className="font-bold">{order.delivery_request.courier_name}</span>
                    {order.delivery_request.courier_phone ? ` · ${order.delivery_request.courier_phone}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] font-semibold">
                  {t("orders.referenceLabel", { reference: order.delivery_request.reference })}
                </p>
              </div>
            ) : order.can_request_delivery ? (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
                <p className="text-[13px] font-bold">{t("orders.arrivedInCountry", { country: BRAND.country })}</p>
                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                  {t("orders.chooseHow", { brand: BRAND.name })}
                </p>
                <Button className="mt-2.5 w-full" onClick={() => setDeliveryOpen(true)}>
                  {t("orders.arrangeDeliveryBtn")}
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <DeliveryRequestForm
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        orderReference={order.reference}
        defaultName={order.delivery_address ? "" : ""}
        defaultPhone={order.customer_phone ?? ""}
        defaultAddress={order.delivery_address ?? ""}
        onDone={() => { setDeliveryOpen(false); load(); }}
      />
    </div>
  );
}

/**
 * The moment after payment.
 *
 * Shown once, straight after checkout. It answers the three questions a buyer
 * has at that instant and then gets out of the way — reloading the page shows
 * the ordinary order screen.
 */
function OrderConfirmation({ order }: { order: Order }) {
  const t = useT();
  const arrival = order.fulfilment?.estimated_arrival_at;
  const isImport = order.fulfilment?.is_local === false;

  const next = isImport
    ? [
        t("orders.nextImport1"),
        t("orders.nextImport2", { country: order.fulfilment?.destination?.name ?? BRAND.country }),
        t("orders.nextImport3"),
      ]
    : [
        t("orders.nextLocal1"),
        t("orders.nextLocal2"),
        t("orders.nextLocal3"),
      ];

  return (
    <section className="rise mb-3 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-surface)]">
      <div className="brand-ground flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-black tracking-[-0.02em] text-white sm:text-[24px]">
            {t("orders.confirmed")}
          </h2>
          <p className="mt-0.5 text-[13px] text-white/75">
            {t("orders.confirmedHint")}
          </p>
        </div>

        {arrival ? (
          <div className="rounded-[var(--radius-sm)] bg-white/12 px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/65">
              {t("orders.estimatedArrival")}
            </p>
            <p className="text-[16px] font-black text-white">{formatDate(arrival)}</p>
          </div>
        ) : null}
      </div>

      <ol className="grid gap-px bg-[color:var(--color-line)] sm:grid-cols-3">
        {next.map((step, index) => (
          <li key={step} className="flex gap-2.5 bg-[color:var(--color-surface)] p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[11px] font-black text-[color:var(--color-brand)]">
              {index + 1}
            </span>
            <span className="text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[color:var(--color-ink-muted)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/** How a payment state reads to the person who owes or paid the money. */
function paymentStatusLabel(
  status: Order["payment_status"],
  t: ReturnType<typeof useT>,
): string {
  if (status === "awaiting_verification") return t("payment.statusPendingVerification");
  if (status === "verified") return t("payment.statusVerified");
  if (status === "rejected") return t("payment.statusRejected");
  if (status === "awaiting_payment") return t("payment.statusAwaitingPayment");
  return t("payment.statusOnDelivery");
}
