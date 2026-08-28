"use client";

import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import vendorApi, { type VendorOrder } from "@/lib/vendor";
import { Button, EmptyState, Skeleton, Tag } from "@/components/ui/Primitives";

/**
 * Vendor order fulfilment.
 *
 * Each row is one order line this seller owes a customer. Status moves
 * forward in place — the seller never leaves the list to action an order.
 */

const TABS = [
  { value: "", label: "seller.tabAll" },
  { value: "pending", label: "seller.tabNew" },
  { value: "processing", label: "seller.statusPreparing" },
  { value: "shipped", label: "seller.statusShipped" },
  { value: "completed", label: "seller.statusCompleted" },
  { value: "cancelled", label: "seller.statusCancelled" },
] as const;

/**
 * The next stage comes from the API, not from a table here: an imported line
 * travels through customs and a warehouse that a local one never sees, and
 * duplicating that route in the console is how the two drift apart.
 */
/** The server's tone words, in the design system's vocabulary. */
const PAYMENT_TONE: Record<string, "success" | "warn" | "sale" | "neutral"> = {
  success: "success",
  warning: "warn",
  danger: "sale",
  info: "neutral",
};

const STATUS_TONE: Record<string, "success" | "warn" | "brand" | "sale" | "neutral"> = {
  completed: "success",
  pending: "warn",
  cancelled: "sale",
  refunded: "sale",
};

export default function VendorOrdersPage() {
  const t = useT();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vendorApi.orders({ status: status || undefined });
      setOrders(data.orders);
    } catch {
      setError(t("seller.ordersLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => { void load(); }, [load]);

  async function advance(order: VendorOrder, next: string) {
    setWorking(order.id);
    try {
      await vendorApi.setOrderStatus(order.id, next);
      // Reload rather than patch locally: cancelling also restores stock, so
      // the server's view is the one worth trusting.
      await load();
    } catch {
      setError(t("seller.orderUpdateFailed"));
      setWorking(null);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="text-[24px] font-black tracking-tight">{t("seller.orders")}</h1>
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          Fulfil orders and keep customers updated.
        </p>
      </header>

      <div className="rail gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`h-9 shrink-0 rounded-[var(--radius-pill)] border px-4 text-[13px] font-semibold transition-colors ${
              status === tab.value
                ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white"
                : "border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)]"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-28 w-full" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title={t("seller.noOrdersHere")}
          message={status ? t("seller.noOrdersHint") : "Orders from customers will appear here."}
        />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const next = order.next_status;

            return (
              <article key={order.id} className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div>
                    <p className="text-[14px] font-extrabold">{order.reference}</p>
                    <p className="text-[11px] text-[color:var(--color-ink-muted)]">
                      {formatDate(order.placed_at)}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Tag tone={order.fulfilment_type === "import" ? "import" : "local"}>
                      {order.origin?.flag ?? (order.fulfilment_type === "import" ? "🌍" : "🇹🇿")}{" "}
                      {order.fulfilment_type === "import" ? "Import" : "Local"}
                    </Tag>
                    {/* Whether the customer has paid, said on the card rather
                        than left for the seller to ask an administrator. A
                        local order on pay-on-delivery is not a problem and
                        does not read like one; an import that reached this
                        list has been paid, and says so. */}
                    {order.payment ? (
                      <Tag tone={PAYMENT_TONE[order.payment.tone] ?? "neutral"}>
                        {order.payment.code === "verified" ? "✓ " : ""}{order.payment.label}
                      </Tag>
                    ) : null}
                    <Tag tone={STATUS_TONE[order.status] ?? "brand"}>
                      {order.status_label ?? order.status}
                    </Tag>
                  </span>
                </div>

                <div className="mt-3 flex gap-3">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]">
                    {order.product?.image ? (
                      <img src={order.product.image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                    ) : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="clamp-2 text-[13px] font-semibold">{order.product?.name ?? t("seller.productRemoved")}</p>
                    <p className="text-[12px] text-[color:var(--color-ink-muted)]">
                      {order.quantity} × {formatMoney(order.price)}
                    </p>
                    <p className="mt-1 text-[15px] font-extrabold">{formatMoney(order.total)}</p>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-[color:var(--color-line)] pt-3 text-[12px] sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-[color:var(--color-ink-muted)]">{t("seller.customer")}</dt>
                    <dd className="clamp-1 font-semibold">{order.customer.name}</dd>
                  </div>
                  {order.customer.phone ? (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-[color:var(--color-ink-muted)]">{t("seller.phone")}</dt>
                      <dd>
                        <a href={`tel:${order.customer.phone}`} className="font-semibold text-[color:var(--color-brand)] hover:underline">
                          {order.customer.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {order.address ? (
                    <div className="flex gap-2 sm:col-span-2">
                      <dt className="shrink-0 text-[color:var(--color-ink-muted)]">{t("seller.deliverTo")}</dt>
                      <dd className="clamp-2">{order.address}</dd>
                    </div>
                  ) : null}
                </dl>

                {next || !["completed", "cancelled"].includes(order.status) ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--color-line)] pt-3">
                    {next ? (
                      <Button
                        size="sm"
                        disabled={working === order.id}
                        onClick={() => advance(order, next.value)}
                      >
                        {working === order.id ? t("seller.updating") : next.label}
                      </Button>
                    ) : null}

                    {!["completed", "cancelled"].includes(order.status) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={working === order.id}
                        onClick={() => {
                          if (window.confirm(t("seller.cancelOrderConfirm"))) {
                            void advance(order, "cancelled");
                          }
                        }}
                        className="text-[color:var(--color-sale)]"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
