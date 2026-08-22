"use client";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import shop from "@/lib/shop";
import { formatDate, formatMoney } from "@/lib/format";
import type { DeliveryRequest } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { TruckIcon, WarehouseIcon } from "@/components/sourcing/icons";
import { Button, ButtonLink, EmptyState, Notice, Skeleton } from "@/components/ui/Primitives";

/**
 * 2KONECT Rides — the shopper's view of their last-mile jobs.
 *
 * Deliberately a list of jobs rather than a page about delivery: each row is
 * one package, where it is going, when, and who is bringing it.
 */
export default function DeliveriesPage() {
  const t = useT();
  const { isAuthenticated, ready, requireAuth } = useAuth();
  const hydrated = useHydrated();
  const [requests, setRequests] = useState<DeliveryRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    shop.deliveries().then(setRequests).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { void requireAuth(); return; }
    load();
  }, [ready, isAuthenticated, requireAuth, load]);

  if (hydrated && ready && !isAuthenticated) {
    return (
      <SiteChrome>
        <EmptyState
          title={t("deliveries.signInTitle")}
          message={t("deliveries.signInHint")}
          action={<Button size="lg" onClick={() => void requireAuth()}>{t("deliveries.signIn")}</Button>}
        />
      </SiteChrome>
    );
  }

  async function cancel(reference: string) {
    if (!window.confirm(t("deliveries.cancelConfirm"))) return;

    setError(null);
    try {
      await shop.cancelDelivery(reference);
      load();
    } catch (err) {
      setError(apiError(err, t("deliveries.cancelFailed")));
    }
  }

  return (
    <SiteChrome>
      <div className="shell py-4 pb-tabbar">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
          2KONECT Rides
        </p>
        <h1 className="mt-0.5 text-[22px] font-black tracking-[-0.02em] md:text-[28px]">
          Your deliveries
        </h1>
        <p className="mt-1 text-[14px] text-[color:var(--color-ink-muted)]">
          Packages on their way to you, and orders waiting to be collected.
        </p>

        {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}

        <div className="mt-4 space-y-3">
          {failed ? (
            <EmptyState
              title={t("deliveries.loadFailed")}
              message={t("common.offline")}
              action={<Button onClick={load}>{t("common.retry")}</Button>}
            />
          ) : requests === null ? (
            Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-[var(--radius-md)]" />
            ))
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<TruckIcon className="h-9 w-9" />}
              title={t("deliveries.empty")}
              message={t("deliveries.emptyHint", { country: BRAND.country })}
              action={<ButtonLink href="/account/orders" size="lg">{t("deliveries.yourOrders")}</ButtonLink>}
            />
          ) : (
            requests.map((request) => (
              <article
                key={request.reference}
                className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4"
              >
                <div className="flex gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]">
                    {request.mode === "pickup" ? <WarehouseIcon className="h-5 w-5" /> : <TruckIcon className="h-5 w-5" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-extrabold">
                          {request.mode === "pickup" ? t("deliveries.collection") : t("deliveries.delivery")} · {request.reference}
                        </p>
                        {request.order_reference ? (
                          <Link
                            href={`/account/orders/${encodeURIComponent(request.order_reference)}`}
                            prefetch={false}
                            className="text-[12px] font-semibold text-[color:var(--color-brand)] hover:underline"
                          >
                            {t("deliveries.orderRef", { reference: request.order_reference })}
                          </Link>
                        ) : null}
                      </div>

                      <span
                        className={`shrink-0 rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-bold ${
                          request.status === "delivered"
                            ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                            : request.status === "cancelled"
                              ? "bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-muted)]"
                              : "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand)]"
                        }`}
                      >
                        {request.status_label}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">
                      {request.mode === "pickup" ? request.pickup_point : request.address}
                    </p>

                    <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                      {request.recipient_name} · {request.recipient_phone}
                      {request.preferred_date ? ` · ${formatDate(request.preferred_date)}` : ""}
                      {request.preferred_window ? ` · ${request.preferred_window}` : ""}
                    </p>

                    {request.courier_name ? (
                      <p className="mt-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] px-2.5 py-1.5 text-[12px]">
                        Rider <span className="font-bold">{request.courier_name}</span>
                        {request.courier_phone ? (
                          <>
                            {" · "}
                            <a href={`tel:${request.courier_phone}`} className="font-bold text-[color:var(--color-brand)]">
                              {request.courier_phone}
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-bold">
                        {request.fee > 0 ? formatMoney(request.fee) : "Free"}
                      </span>
                      {!["delivered", "cancelled"].includes(request.status) ? (
                        <button
                          type="button"
                          onClick={() => cancel(request.reference)}
                          className="tap text-[12px] font-bold text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-sale)] hover:underline"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </SiteChrome>
  );
}
