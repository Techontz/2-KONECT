"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import shop from "@/lib/shop";
import { useAuth } from "@/lib/store/auth";
import { useWishlist } from "@/lib/store/wishlist";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Button, EmptyState } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/** Account hub — profile summary and links to the rest of the account area. */
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
  const wishlist = useWishlist();
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { void requireAuth(); return; }

    shop.orders().then((orders) => setOrderCount(orders.length)).catch(() => setOrderCount(0));
  }, [ready, isAuthenticated, requireAuth]);

  if (ready && !isAuthenticated) {
    return (
      <EmptyState
        title={t("account.signInTitle")}
        message={t("account.signInHint")}
        action={<Button size="lg" onClick={() => void requireAuth()}>{t("account.signInAction")}</Button>}
      />
    );
  }

  return (
    <div className="shell py-4">
      <section className="mb-4 overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-brand)]">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-ink)] text-xl font-black text-[color:var(--color-brand)]">
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <p className="text-[20px] font-black leading-tight">{user?.name}</p>
            <p className="clamp-1 text-[13px] opacity-70">{user?.email}</p>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={t("account.orders")} value={orderCount === null ? "—" : String(orderCount)} href="/account/orders" />
        <StatTile label={t("account.wishlist")} value={String(wishlist.count)} href="/wishlist" />
        <StatTile label={t("account.cart")} value={t("account.view")} href="/cart" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-2">
          <h2 className="px-2 py-2 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
            {t("account.shopping")}
          </h2>
          <MenuRow href="/account/orders" icon="📦" label={t("account.myOrders")} hint={t("account.myOrdersHint")} />
          <MenuRow href="/wishlist" icon="❤️" label={t("account.myWishlist")} hint={t("wishlist.itemCount", { count: wishlist.count })} />
          <MenuRow href="/account/addresses" icon="📍" label={t("account.addresses")} hint={t("account.addressesHint")} />
          <MenuRow href="/account/messages" icon="💬" label={t("chat.inbox")} hint={t("chat.inboxEmptyHint")} />
        </section>

        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-2">
          <h2 className="px-2 py-2 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
            {BRAND.short}
          </h2>
          {user?.role === "vendor" ? (
            <MenuRow href="/vendor/dashboard" icon="🏪" label={t("account.sellerDashboard")} hint={t("account.sellerDashboardHint")} />
          ) : (
            <MenuRow href="/sell" icon="🏪" label={t("header.sellOn", { brand: BRAND.short })} hint={t("account.startStore")} />
          )}
          <MenuRow href="/help" icon="💬" label={t("account.help")} hint={t("account.helpHint")} />
          <MenuRow href="/legal/privacy" icon="🔒" label={t("account.privacy")} />

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-left transition-colors hover:bg-[color:var(--color-surface-alt)]"
          >
            <span aria-hidden="true">🚪</span>
            <span className="text-sm font-semibold text-[color:var(--color-sale)]">{t("account.logout")}</span>
          </button>
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4 transition-shadow hover:shadow-[var(--shadow-hover)]"
    >
      <p className="text-[22px] font-black leading-none">{value}</p>
      <p className="mt-1 text-[12px] text-[color:var(--color-ink-muted)]">{label}</p>
    </Link>
  );
}

function MenuRow({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: string;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 transition-colors hover:bg-[color:var(--color-surface-alt)]"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? (
          <span className="clamp-1 block text-[11px] text-[color:var(--color-ink-muted)]">{hint}</span>
        ) : null}
      </span>
      <span aria-hidden="true" className="shrink-0 text-[color:var(--color-ink-faint)]">›</span>
    </Link>
  );
}
