"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { isForbidden } from "@/lib/api";
import vendorApi, { type VendorDashboard } from "@/lib/vendor";
import { Button, ButtonLink, EmptyState, Skeleton } from "@/components/ui/Primitives";
import { SellerStatusBanner } from "@/components/vendor/SellerStatusBanner";
import { useT } from "@/lib/i18n";

/**
 * Seller dashboard — sales, orders, inventory and earnings at a glance.
 *
 * Every figure comes from the vendor's own rows via `/shop/vendor/dashboard`.
 * Nothing is estimated or padded, and the whole view is one request so the
 * page paints quickly on a poor connection.
 */
export default function VendorDashboardPage() {
  const t = useT();
  const [data, setData] = useState<VendorDashboard | null>(null);
  const [failed, setFailed] = useState<"none" | "no-store" | "error">("none");

  useEffect(() => {
    vendorApi
      .dashboard()
      .then(setData)
      // 403 here means the account has no store record, which the console shell
      // normally catches first. It is answered separately anyway, because
      // "refresh or sign in again" is wrong advice for it: the session is fine,
      // and no amount of signing in will conjure a store.
      .catch((error) => setFailed(isForbidden(error) ? "no-store" : "error"));
  }, []);

  if (failed === "no-store") {
    return (
      <EmptyState
        title={t("seller.profileNotSetUp")}
        message={t("seller.profileNotSetUpHint")}
        action={<ButtonLink href="/help/contact">Contact {BRAND.name}</ButtonLink>}
      />
    );
  }

  if (failed === "error") {
    return (
      <EmptyState
        title={t("seller.dashboardLoadFailed")}
        message={t("seller.dashboardLoadFailedHint")}
        action={<Button onClick={() => window.location.reload()}>Retry</Button>}
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-3 p-4 lg:p-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { vendor, stats, sales_trend: trend, top_products: top, low_stock_products: lowStock } = data;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Application and verification state, straight from the backend. */}
      <SellerStatusBanner />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-black tracking-tight">{vendor.name}</h1>
          <p className="text-[13px] text-[color:var(--color-ink-muted)]">
            {vendor.since ? `Selling since ${vendor.since}` : "Welcome to your seller console"}
          </p>
        </div>
        <ButtonLink href="/vendor/products">Manage products</ButtonLink>
      </header>

      {!vendor.is_approved ? (
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] p-4">
          <p className="text-[14px] font-bold text-[color:var(--color-warn)]">
            Your store is awaiting approval
          </p>
          <p className="text-[13px] text-[color:var(--color-ink-muted)]">
            You can add products now — they go live on the marketplace as soon as an
            administrator approves your store.
          </p>
        </div>
      ) : null}

      {/* ---- headline stats ---- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Earnings"
          value={formatMoney(stats.earnings, "TZS")}
          hint={`${formatMoney(stats.paid_out, "TZS")} completed`}
          tone="success"
        />
        <StatCard
          label={t("seller.orders")}
          value={String(stats.orders)}
          hint={stats.orders_pending > 0 ? `${stats.orders_pending} need action` : "All up to date"}
          tone={stats.orders_pending > 0 ? "warn" : "default"}
          href="/vendor/orders"
        />
        <StatCard
          label={t("seller.products")}
          value={String(stats.products)}
          hint={`${stats.in_stock} in stock · ${stats.out_of_stock} sold out`}
          href="/vendor/products"
        />
        <StatCard
          label="Units sold"
          value={String(stats.units_sold)}
          hint={`${stats.low_stock} products low on stock`}
          tone={stats.low_stock > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SalesTrend trend={trend} />

        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <h2 className="mb-3 text-[15px] font-extrabold">{t("home.bestSellers")}</h2>
          {top.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[color:var(--color-ink-muted)]">
              No sales yet — your best sellers will appear here.
            </p>
          ) : (
            <ol className="space-y-2">
              {top.map((product, index) => (
                <li key={product.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-alt)] text-[11px] font-bold">
                    {index + 1}
                  </span>
                  <Link
                    href={`/product?id=${product.id}`}
                    className="clamp-1 min-w-0 flex-1 text-[13px] font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-bold">{product.units} sold</span>
                    <span className="block text-[11px] text-[color:var(--color-ink-muted)]">
                      {formatMoney(product.revenue, "TZS")}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {lowStock.length > 0 ? (
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-extrabold">Restock soon</h2>
            <Link href="/vendor/products?stock=low" className="text-[12px] font-bold text-[color:var(--color-brand)] hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>

          <div className="rail gap-3">
            {lowStock.map((product) => (
              <Link
                key={product.id}
                href={`/vendor/products?q=${encodeURIComponent(product.name)}`}
                className="w-36 shrink-0"
              >
                <span className="block aspect-square w-full overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]">
                  {product.image ? (
                    <img src={product.image} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                  ) : null}
                </span>
                <span className="clamp-2 mt-1.5 block text-[12px] leading-tight">{product.name}</span>
                <span
                  className={`mt-0.5 block text-[11px] font-bold ${
                    product.stock <= 0 ? "text-[color:var(--color-sale)]" : "text-[color:var(--color-warn)]"
                  }`}
                >
                  {product.stock <= 0 ? "Sold out" : `${product.stock} left`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warn";
  href?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : "text-[color:var(--color-ink)]";

  const body = (
    <div className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
        {label}
      </p>
      <p className={`mt-1 text-[22px] font-black leading-tight ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-muted)]">{hint}</p> : null}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

/**
 * 30-day revenue bars.
 *
 * Drawn with plain divs rather than a charting library — it is a handful of
 * bars, and the console should stay fast on a modest connection.
 */
function SalesTrend({ trend }: { trend: { date: string; total: number }[] }) {
  const peak = Math.max(...trend.map((point) => point.total), 1);
  const total = trend.reduce((sum, point) => sum + point.total, 0);

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">Last 30 days</h2>
        <span className="text-[13px] text-[color:var(--color-ink-muted)]">
          <span className="font-bold text-[color:var(--color-ink)]">{formatMoney(total, "TZS")}</span> earned
        </span>
      </div>

      <div className="flex h-40 items-end gap-[3px]">
        {trend.map((point) => (
          <span
            key={point.date}
            title={`${point.date}: ${formatMoney(point.total, "TZS")}`}
            className="flex-1 rounded-t-[2px] bg-[color:var(--color-brand)] transition-opacity hover:opacity-70"
            style={{
              // A floor of 2% keeps zero-sale days visible as a baseline tick
              // instead of vanishing and making the axis look broken.
              height: `${Math.max(2, (point.total / peak) * 100)}%`,
              opacity: point.total === 0 ? 0.15 : 1,
            }}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-[color:var(--color-ink-faint)]">
        <span>{trend[0]?.date}</span>
        <span>{trend[trend.length - 1]?.date}</span>
      </div>
    </section>
  );
}
