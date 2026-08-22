"use client";

import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import shop from "@/lib/shop";
import { formatDate, formatMoney } from "@/lib/format";
import type { SourcingRequest } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Button, ButtonLink, EmptyState, Notice, Skeleton } from "@/components/ui/Primitives";

/**
 * Sourcing requests, as the shopper sees them.
 *
 * A request is a job with a ladder, not a contact-form receipt, so it gets the
 * same treatment an order does: a reference, a progress bar and the next step
 * spelled out.
 */
export default function RequestsPage() {
  const t = useT();
  const { isAuthenticated, ready, requireAuth } = useAuth();
  const hydrated = useHydrated();
  const [requests, setRequests] = useState<SourcingRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    shop.myRequests().then(setRequests).catch(() => setFailed(true));
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
          title={t("requests.signInTitle")}
          message={t("requests.signInHint")}
          action={<Button size="lg" onClick={() => void requireAuth()}>{t("requests.signIn")}</Button>}
        />
      </SiteChrome>
    );
  }

  async function cancel(reference: string) {
    if (!window.confirm(t("requests.withdrawConfirm"))) return;

    setError(null);
    try {
      await shop.cancelRequest(reference);
      load();
    } catch (err) {
      setError(apiError(err, t("requests.cancelFailed")));
    }
  }

  return (
    <SiteChrome>
      <div className="shell py-4 pb-tabbar">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.02em] md:text-[28px]">{t("requests.yourRequests")}</h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-ink-muted)]">
              {t("requests.yourRequestsHint")}
            </p>
          </div>
          <ButtonLink href="/request">{t("requests.newRequest")}</ButtonLink>
        </div>

        {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}

        <div className="mt-4 space-y-3">
          {failed ? (
            <EmptyState
              title={t("requests.loadFailed")}
              message={t("common.offline")}
              action={<Button onClick={load}>{t("common.retry")}</Button>}
            />
          ) : requests === null ? (
            Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-[var(--radius-md)]" />
            ))
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-9 w-9" />}
              title={t("requests.empty")}
              message={t("requests.emptyHint")}
              action={<ButtonLink href="/request" size="lg">{t("requests.requestProduct")}</ButtonLink>}
            />
          ) : (
            requests.map((request) => (
              <RequestCard key={request.reference} request={request} onCancel={() => cancel(request.reference)} />
            ))
          )}
        </div>
      </div>
    </SiteChrome>
  );
}

function RequestCard({ request, onCancel }: { request: SourcingRequest; onCancel(): void }) {
  const t = useT();
  const percent = request.step > 0 ? (request.step / request.total_steps) * 100 : 0;
  const cancellable = ["submitted", "reviewing", "sourcing", "quoted"].includes(request.status);

  return (
    <article className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <div className="flex gap-3">
        {request.image ? (
          <img
            src={request.image}
            alt=""
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-[var(--radius-sm)] object-cover ring-1 ring-[color:var(--color-line)]"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-400)]">
            <SearchIcon className="h-7 w-7" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold">{request.name}</p>
              <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                {request.reference} ·{" "}
                {request.quantity === 1 ? t("requests.unitOne") : t("requests.units", { count: request.quantity })}
                {request.created_at ? ` · ${formatDate(request.created_at)}` : ""}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-bold ${
                request.is_open
                  ? "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand)]"
                  : request.status === "completed"
                    ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                    : "bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-muted)]"
              }`}
            >
              {request.status_label}
            </span>
          </div>

          {request.step > 0 ? (
            <div className="mt-2.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-line)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-brand)] transition-[width] duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
                Step {request.step} of {request.total_steps}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* A price we have quoted is the thing the shopper is waiting for, so it
          gets its own block rather than a line of body text. */}
      {request.quote ? (
        <div className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
            We found it
          </p>
          <p className="mt-0.5 text-[20px] font-black">{formatMoney(request.quote.price)}</p>
          {request.quote.eta_max ? (
            <p className="text-[12px] text-[color:var(--color-ink-muted)]">
              Arrives in {request.quote.eta_min ?? request.quote.eta_max}–{request.quote.eta_max} days
              once confirmed.
            </p>
          ) : null}
          <p className="mt-1.5 text-[12px] text-[color:var(--color-ink-soft)]">
            Our team will call you to confirm before anything is ordered.
          </p>
        </div>
      ) : null}

      {request.note ? (
        <Notice tone="info" className="mt-3">{request.note}</Notice>
      ) : null}

      {cancellable ? (
        <button
          type="button"
          onClick={onCancel}
          className="tap mt-1 text-[12px] font-bold text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-sale)] hover:underline"
        >
          Withdraw this request
        </button>
      ) : null}
    </article>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
