"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

import shop from "@/lib/shop";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { JourneyStrip } from "@/components/sourcing/JourneyTimeline";
import { RouteLine } from "@/components/sourcing/Availability";
import { Button, ButtonLink, EmptyState, Skeleton, Tag } from "@/components/ui/Primitives";

/**
 * Order history.
 *
 * Each order shows how far along its journey it is before anything else,
 * because "where is my order" is the only reason anyone opens this page.
 */
export default function OrdersPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
        <OrdersContent />
      </Suspense>
    </SiteChrome>
  );
}

function OrdersContent() {
  const { isAuthenticated, ready, requireAuth } = useAuth();
  const hydrated = useHydrated();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { void requireAuth(); return; }

    shop.orders().then(setOrders).catch(() => setFailed(true));
  }, [ready, isAuthenticated, requireAuth]);

  if (hydrated && ready && !isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to see your orders"
        message="Your order history and tracking live in your account."
        action={<Button size="lg" onClick={() => void requireAuth()}>Sign in</Button>}
      />
    );
  }

  const visible = (orders ?? []).filter((order) => {
    if (filter === "all") return true;
    const done = ["completed", "cancelled", "refunded"].includes(order.status);
    return filter === "completed" ? done : !done;
  });

  return (
    <div className="shell py-4 pb-tabbar">
      <h1 className="text-[22px] font-black tracking-[-0.02em] md:text-[28px]">Your orders</h1>
      <p className="mt-1 text-[14px] text-[color:var(--color-ink-muted)]">
        Everything you have bought, and exactly where it is.
      </p>

      <div className="mt-4 flex gap-1.5">
        {([
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "completed", label: "Completed" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            aria-pressed={filter === tab.key}
            className={`flex min-h-10 items-center rounded-[var(--radius-pill)] px-4 text-[13px] font-bold transition-colors ${
              filter === tab.key
                ? "bg-[color:var(--color-brand)] text-white"
                : "border border-[color:var(--color-line-strong)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {failed ? (
          <EmptyState
            title="We couldn’t load your orders"
            message="Check your connection and try again."
            action={<Button onClick={() => window.location.reload()}>Try again</Button>}
          />
        ) : orders === null ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-[var(--radius-md)]" />
          ))
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BoxIcon className="h-9 w-9" />}
            title={filter === "all" ? "No orders yet" : `No ${filter} orders`}
            message={
              filter === "all"
                ? "When you buy something it appears here, with tracking from the moment you pay."
                : "Try another tab to see the rest of your orders."
            }
            action={filter === "all" ? <ButtonLink href="/shop" size="lg">Start shopping</ButtonLink> : null}
          />
        ) : (
          visible.map((order) => <OrderCard key={order.reference} order={order} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const current = order.timeline?.find((step) => step.state === "current");
  const closed = ["completed", "cancelled", "refunded"].includes(order.status);

  return (
    <Link
      href={`/account/orders/${encodeURIComponent(order.reference)}`}
      prefetch={false}
      className="block rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 transition-all hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-black tracking-wide">{order.reference}</span>
            <Tag tone={order.fulfilment?.is_local === false ? "import" : "local"}>
              {order.fulfilment?.is_local === false ? "🌍 Import" : "🇹🇿 Local"}
            </Tag>
          </p>
          <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
            Placed {formatDate(order.placed_at)} · {order.item_count}{" "}
            {order.item_count === 1 ? "item" : "items"}
          </p>
        </div>

        <p className="text-right">
          <span className="block text-[17px] font-black">{formatMoney(order.total)}</span>
          <span
            className={`text-[12px] font-bold ${
              order.status === "cancelled" || order.status === "refunded"
                ? "text-[color:var(--color-danger)]"
                : order.status === "completed"
                  ? "text-[color:var(--color-success)]"
                  : "text-[color:var(--color-brand)]"
            }`}
          >
            {order.status_label ?? order.status}
          </span>
        </p>
      </div>

      {/* Progress before the product images: this is the answer to the only
          question the page is being asked. */}
      {order.timeline?.length ? (
        <div className="mt-3">
          <JourneyStrip timeline={order.timeline} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="font-semibold text-[color:var(--color-ink-soft)]">
              {current?.title ?? order.status_label ?? order.status}
            </span>
            {!closed && order.fulfilment?.estimated_arrival_at ? (
              <span className="text-[color:var(--color-ink-muted)]">
                Expected by{" "}
                <span className="font-bold text-[color:var(--color-ink)]">
                  {formatDate(order.fulfilment.estimated_arrival_at)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {order.fulfilment && !order.fulfilment.is_local ? (
        <RouteLine
          from={order.fulfilment.origin}
          to={order.fulfilment.destination}
          className="mt-2 text-[color:var(--color-ink-muted)]"
        />
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-[color:var(--color-line)] pt-3">
        {order.items.slice(0, 4).map((item) => (
          <span
            key={item.id}
            className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]"
          >
            {item.product?.image ? (
              <img src={item.product.image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
            ) : null}
          </span>
        ))}
        {order.items.length > 4 ? (
          <span className="text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
            +{order.items.length - 4} more
          </span>
        ) : null}

        {order.can_request_delivery ? (
          <span className="ml-auto rounded-[var(--radius-sm)] bg-[color:var(--color-brand-100)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--color-brand)]">
            Arrange delivery
          </span>
        ) : (
          <span className="ml-auto text-[12px] font-bold text-[color:var(--color-brand)]">
            View details →
          </span>
        )}
      </div>
    </Link>
  );
}

function BoxIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8.2L12 3 3 8.2v7.6L12 21l9-5.2V8.2z" />
      <path d="M3 8.2l9 5.2 9-5.2M12 13.4V21" />
    </svg>
  );
}
