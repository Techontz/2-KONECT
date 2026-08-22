"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BRAND } from "@/lib/brand";
import shop from "@/lib/shop";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { useWishlist } from "@/lib/store/wishlist";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Logo } from "@/components/brand/Logo";
import { Button, EmptyState } from "@/components/ui/Primitives";

/** Account hub — a summary, then everything the account can reach. */
export default function AccountPage() {
  return (
    <SiteChrome>
      <AccountContent />
    </SiteChrome>
  );
}

function AccountContent() {
  const t = useT();
  const { user, isAuthenticated, ready, logout, requireAuth } = useAuth();
  const hydrated = useHydrated();
  const wishlist = useWishlist();

  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { void requireAuth(); return; }

    shop
      .orders()
      .then((orders) => {
        setOrderCount(orders.length);
        setActiveCount(
          orders.filter((order) => !["completed", "cancelled", "refunded"].includes(order.status)).length,
        );
      })
      .catch(() => { setOrderCount(0); setActiveCount(0); });

    shop.myRequests().then((rows) => setRequestCount(rows.length)).catch(() => setRequestCount(0));
  }, [ready, isAuthenticated, requireAuth]);

  if (hydrated && ready && !isAuthenticated) {
    return (
      <EmptyState
        title={t("account.signInTitle")}
        message={t("account.signInHint")}
        action={<Button size="lg" onClick={() => void requireAuth()}>{t("account.signIn")}</Button>}
      />
    );
  }

  const sections: { id: string; title: string; links: { href: string; label: string; note: string }[] }[] = [
    {
      id: "orders",
      title: t("account.ordersDelivery"),
      links: [
        { href: "/account/orders", label: t("account.myOrders"), note: t("account.myOrdersNote") },
        { href: "/account/deliveries", label: t("account.deliveries"), note: t("account.deliveriesNote", { brand: BRAND.name }) },
        { href: "/track", label: t("account.trackByReference"), note: t("account.trackByReferenceNote") },
      ],
    },
    {
      id: "sourcing",
      title: t("account.sourcing"),
      links: [
        { href: "/account/requests", label: t("account.myRequests"), note: t("account.myRequestsNote") },
        { href: "/request", label: t("account.requestProduct"), note: t("account.requestProductNote") },
      ],
    },
    {
      id: "details",
      title: t("account.yourDetails"),
      links: [
        { href: "/account/addresses", label: t("account.addresses"), note: t("account.addressesNote") },
        { href: "/wishlist", label: t("account.savedItems"), note: t("account.savedItemsNote") },
        { href: "/account/messages", label: t("account.messages"), note: t("account.messagesNote") },
      ],
    },
  ];

  return (
    <div className="shell py-4 pb-tabbar">
      {/* ---- who you are ---- */}
      <section className="brand-ground mb-4 overflow-hidden rounded-[var(--radius-md)]">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl font-black text-white">
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-black leading-tight text-white">{user?.name}</p>
            <p className="clamp-1 text-[13px] text-white/70">{user?.email}</p>
          </div>
          <Logo tone="dark" size="sm" showWordmark={false} className="hidden sm:flex" />
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t("account.activeOrders")} value={activeCount} href="/account/orders" accent />
        <StatTile label={t("account.allOrders")} value={orderCount} href="/account/orders" />
        <StatTile label={t("account.requests")} value={requestCount} href="/account/requests" />
        <StatTile label={t("account.saved")} value={wishlist.count} href="/wishlist" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              {section.title}
            </h2>
            <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
              {section.links.map((link) => (
                <li key={link.href} className="border-b border-[color:var(--color-line)] last:border-0">
                  <Link
                    href={link.href}
                    prefetch={false}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--color-surface-alt)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">{link.label}</span>
                      <span className="block truncate text-[12px] text-[color:var(--color-ink-muted)]">
                        {link.note}
                      </span>
                    </span>
                    <ChevronIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-faint)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* ---- selling ---- */}
      <section className="mt-5 rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-4">
        <p className="text-[15px] font-black">
          {user?.role === "vendor" ? "You sell with us" : `Sell with ${BRAND.name}`}
        </p>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-muted)]">
          {user?.role === "vendor"
            ? "Manage your products, stock and orders in the seller console."
            : "Reach buyers across Tanzania on a marketplace where sellers are reviewed."}
        </p>
        <Link
          href={user?.role === "vendor" ? "/vendor/dashboard" : "/sell"}
          prefetch={false}
          className="mt-3 inline-flex h-11 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-5 text-[14px] font-bold text-white"
        >
          {user?.role === "vendor" ? "Open seller console" : "Apply to sell"}
        </Link>
      </section>

      <div className="mt-5">
        <Button variant="secondary" onClick={logout}>{t("account.logout")}</Button>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
  accent = false,
}: {
  label: string;
  value: number | null;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`rounded-[var(--radius-md)] border p-4 transition-colors ${
        accent
          ? "border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] hover:bg-[color:var(--color-brand-100)]"
          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-line-strong)]"
      }`}
    >
      <span className={`block text-[26px] font-black leading-none ${accent ? "text-[color:var(--color-brand)]" : ""}`}>
        {value === null ? "—" : value}
      </span>
      <span className="mt-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
        {label}
      </span>
    </Link>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
