"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/store/auth";
import { Button, ButtonLink, EmptyState } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * Seller console shell.
 *
 * Deliberately plainer and denser than the storefront: a vendor is doing work
 * here, not shopping, so it is a sidebar console with no marketing chrome and
 * no animation. Access is gated on the account actually being a seller — a
 * customer who lands on these URLs is told, not silently shown an empty page.
 */

const NAV = [
  { href: "/vendor/dashboard", label: "seller.dashboard", icon: "▦" },
  { href: "/vendor/products", label: "seller.products", icon: "▤" },
  { href: "/vendor/orders", label: "seller.orders", icon: "▣" },
  { href: "/vendor/settings", label: "seller.storeSettings", icon: "⚙" },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { user, isAuthenticated, ready, requireAuth, logout } = useAuth();

  useEffect(() => {
    if (ready && !isAuthenticated) void requireAuth();
  }, [ready, isAuthenticated, requireAuth]);

  if (!ready) {
    return <div className="min-h-screen bg-[color:var(--color-canvas)]" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[color:var(--color-canvas)]">
        <EmptyState
          title="Sign in to your seller account"
          message="The seller console is only available to registered sellers."
          action={<Button size="lg" onClick={() => void requireAuth()}>Sign in</Button>}
        />
      </div>
    );
  }

  if (user?.role !== "vendor") {
    return (
      <div className="min-h-screen bg-[color:var(--color-canvas)]">
        <EmptyState
          title="This isn't a seller account"
          message={`You're signed in as a shopper. Apply to sell on ${BRAND.short} to get a seller console.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/sell" size="lg">Become a seller</ButtonLink>
              <ButtonLink href="/" size="lg" variant="secondary">{t("seller.backToShop")}</ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[color:var(--color-canvas)]">
      {/* ---- sidebar (desktop) ---- */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[color:var(--color-line)] bg-[color:var(--color-surface)] lg:flex">
        <Link href="/" className="flex items-baseline gap-1 border-b border-[color:var(--color-line)] px-4 py-4">
          <span className="text-[17px] font-black leading-none tracking-tight">
            {BRAND.wordmark.lead}
            <span className="opacity-60">{BRAND.wordmark.tail}</span>
          </span>
        </Link>

        <div className="px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-ink-faint)]">
            Seller console
          </p>
          <p className="clamp-1 text-[13px] font-bold">{user?.vendor?.business_name ?? user?.name}</p>
          {user?.vendor ? (
            <p className={`mt-1 text-[11px] font-semibold ${user.vendor.is_approved ? "text-[color:var(--color-success)]" : "text-[color:var(--color-warn)]"}`}>
              {user.vendor.is_approved ? "✓ Approved" : "⏳ Pending approval"}
            </p>
          ) : null}
        </div>

        <nav className="flex-1 px-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-[color:var(--color-action-soft)] text-[color:var(--color-action)]"
                    : "text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)]"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {t(item.label as never)}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[color:var(--color-line)] p-2">
          <Link
            href="/"
            className="block rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)]"
          >
            ← {t("seller.backToShop")}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] font-semibold text-[color:var(--color-sale)] hover:bg-[color:var(--color-surface-alt)]"
          >{t("seller.logout")}</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---- mobile top bar ---- */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3 lg:hidden">
          <span className="text-[15px] font-black tracking-tight">Seller console</span>
          <Link href="/" className="text-[12px] font-bold text-[color:var(--color-action)]">
            {t("seller.backToShop")}
          </Link>
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-6">{children}</main>

        {/* ---- mobile bottom nav ---- */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] lg:hidden">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
                  active ? "text-[color:var(--color-action)]" : "text-[color:var(--color-ink-muted)]"
                }`}
              >
                <span aria-hidden="true" className="text-base">{item.icon}</span>
                {t(item.label as never)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
