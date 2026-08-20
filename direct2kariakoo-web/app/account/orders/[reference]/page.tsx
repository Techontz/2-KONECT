"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import shop from "@/lib/shop";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
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
  const params = useParams<{ reference: string }>();
  const search = useSearchParams();
  const reference = decodeURIComponent(String(params.reference ?? ""));
  const justPlaced = search.get("placed") === "1";

  const { isAuthenticated, ready, requireAuth } = useAuth();

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

  if (ready && !isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to track this order"
        message="Order tracking is tied to the account that placed it."
        action={<Button size="lg" onClick={() => void requireAuth()}>Sign in</Button>}
      />
    );
  }

  if (missing) {
    return (
      <EmptyState
        title="We couldn’t find that order"
        message={`No order matching ${reference} on this account. Check the reference, or look through your order history.`}
        action={<ButtonLink href="/account/orders">Your orders</ButtonLink>}
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
    if (!window.confirm("Cancel this order? Anything reserved goes back on sale.")) return;

    setBusy(true);
    setError(null);
    try {
      await shop.cancelOrder(reference);
      load();
    } catch (err) {
      setError(apiError(err, "We couldn’t cancel this order."));
    } finally {
      setBusy(false);
    }
  }

  const fulfilment = order.fulfilment;

  return (
    <div className="shell py-4 pb-tabbar">
      <nav aria-label="Breadcrumb" className="mb-2 text-[12px] text-[color:var(--color-ink-muted)]">
        <Link href="/account/orders" prefetch={false} className="crumb hover:text-[color:var(--color-brand)]">
          ← Your orders
        </Link>
      </nav>

      {justPlaced ? (
        <Notice tone="success" title="Order placed" className="mb-3">
          Thank you. We have your order and you can follow it right here — we will
          update this page at every step.
        </Notice>
      ) : null}

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
            <p className="text-[24px] font-black tracking-[-0.02em]">{formatMoney(order.total)}</p>
            <p className="text-[12px] text-[color:var(--color-ink-muted)]">
              {order.payment_method === "cash_on_delivery" ? "Cash on delivery" : order.payment_method}
            </p>
          </div>
        </div>

        {/* The single most useful fact on the page, given its own line. */}
        {fulfilment?.estimated_arrival_at && order.status !== "completed" && order.status !== "cancelled" ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                Estimated arrival
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
            <Button onClick={() => setDeliveryOpen(true)}>Arrange delivery</Button>
          ) : null}
          {order.can_cancel ? (
            <Button variant="secondary" onClick={cancel} loading={busy}>
              Cancel order
            </Button>
          ) : null}
          <ButtonLink href="/account/messages" variant="ghost">Need help?</ButtonLink>
        </div>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ---- the journey ---- */}
        <section className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <h2 className="px-4 pt-4 text-[16px] font-black">Order journey</h2>
          {fulfilment ? (
            <JourneyTimeline timeline={order.timeline} fulfilment={fulfilment} className="mt-1" />
          ) : null}
        </section>

        <div className="space-y-3">
          {/* ---- what was ordered ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-3 text-[16px] font-black">Items</h2>
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
                  <span className="shrink-0 text-[13px] font-bold">{formatMoney(item.total)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1.5 border-t border-[color:var(--color-line)] pt-3 text-[13px]">
              <Row label="Subtotal" value={formatMoney(order.subtotal)} />
              <Row label="Delivery" value={formatMoney(order.delivery_fee)} />
              <div className="flex justify-between gap-3 border-t border-[color:var(--color-line)] pt-1.5">
                <dt className="font-black">Total</dt>
                <dd className="text-[17px] font-black">{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </section>

          {/* ---- where it goes ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-2 text-[16px] font-black">Delivery</h2>
            <dl className="space-y-2 text-[13px]">
              {order.delivery_address ? (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    Address
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
                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                  {order.delivery_request.preferred_date
                    ? `${formatDate(order.delivery_request.preferred_date)}${
                        order.delivery_request.preferred_window ? ` · ${order.delivery_request.preferred_window}` : ""
                      }`
                    : "We will confirm a time with you."}
                </p>
                {order.delivery_request.courier_name ? (
                  <p className="mt-1 text-[12px]">
                    Rider: <span className="font-bold">{order.delivery_request.courier_name}</span>
                    {order.delivery_request.courier_phone ? ` · ${order.delivery_request.courier_phone}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] font-semibold">
                  Reference {order.delivery_request.reference}
                </p>
              </div>
            ) : order.can_request_delivery ? (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
                <p className="text-[13px] font-bold">Your order is in Tanzania.</p>
                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                  Choose how you want it: a 2KONECT rider brings it to you, or you collect it.
                </p>
                <Button className="mt-2.5 w-full" onClick={() => setDeliveryOpen(true)}>
                  Arrange delivery
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[color:var(--color-ink-muted)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
