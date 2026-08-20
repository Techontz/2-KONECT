"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/brand/Logo";
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

/**
 * The console's navigation, in one list.
 *
 * `primary` entries are the four that earn a place in the mobile bottom bar;
 * everything else is reachable from the "More" sheet beside them and from the
 * sidebar on a wide screen. Every href is a route that exists — nothing here
 * is a placeholder.
 */
const NAV = [
  { href: "/vendor/dashboard", label: "seller.dashboard", icon: "▦", primary: true },
  { href: "/vendor/products", label: "seller.myProducts", icon: "▤", primary: true },
  { href: "/vendor/orders", label: "seller.orders", icon: "▣", primary: true },
  { href: "/vendor/messages", label: "chat.title", icon: "✉", primary: true },
  { href: "/vendor/products/new", label: "seller.addProduct", icon: "＋", primary: false },
  { href: "/vendor/settings/wallet", label: "seller.wallet", icon: "◈", primary: false },
  { href: "/vendor/settings/profile", label: "seller.storeProfile", icon: "◎", primary: false },
  { href: "/vendor/settings", label: "seller.storeSettings", icon: "⚙", primary: false },
] as const;

/** Longest match wins, so /vendor/products/new does not also light up Products. */
function isActive(pathname: string, href: string): boolean {
  const match = NAV.filter((item) => pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href === href;
}

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { user, isAuthenticated, ready, requireAuth, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // The sheet must not survive a move to another console page.
  useEffect(() => setMoreOpen(false), [pathname]);

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

  // Signed in as a seller, but this account has no store record behind it.
  //
  // A handful of older accounts were marked as sellers before a store row was
  // required, so every console endpoint answers 403 for them. That is a missing
  // *profile*, not a bad session — telling them to sign in again sends them
  // round a loop that cannot end, and so does "apply to sell", because /sell
  // recognises the vendor role and points straight back here. Only support can
  // resolve it, so that is what this offers.
  //
  // Deliberately `=== null`, which is what a confirmed /me answer looks like.
  // An older cached account object with no vendor key at all is `undefined` and
  // falls through to the console as before, so a real seller is never locked
  // out by a stale cache.
  if (user?.role === "vendor" && user.vendor === null) {
    return (
      <div className="min-h-screen bg-[color:var(--color-canvas)]">
        <EmptyState
          title="Your seller profile isn't set up yet"
          message={`Your account is registered as a seller, but it has no store attached — so there are no products, orders or payouts to show. Our team can finish the setup for you; it usually takes one working day once you have been in touch.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/help/contact" size="lg">Contact {BRAND.name}</ButtonLink>
              <ButtonLink href="/" size="lg" variant="secondary">{t("seller.backToShop")}</ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  if (user?.role !== "vendor") {
    return (
      <div className="min-h-screen bg-[color:var(--color-canvas)]">
        <EmptyState
          title="This isn't a seller account"
          message={`You're signed in as a shopper. Apply to sell with ${BRAND.name} to get a seller console.`}
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
        {/* The wordmark goes to the console's own home. For a signed-in seller
            "/" is redirected straight back here, so linking there would just
            look broken. */}
        <Link href="/vendor/dashboard" className="flex items-center border-b border-[color:var(--color-line)] px-4 py-4">
          <Logo size="md" />
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

        <nav className="flex-1 overflow-y-auto px-2">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]"
                    : "text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)]"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {t(item.label as never)}
              </Link>
            );
          })}
        </nav>

        {/* No "back to shop": a signed-in seller is routed to the console from
            every storefront URL, so the link could only bounce them back here. */}
        <div className="border-t border-[color:var(--color-line)] p-2">
          <button
            type="button"
            onClick={logout}
            className="block min-h-11 w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] font-semibold text-[color:var(--color-sale)] hover:bg-[color:var(--color-surface-alt)]"
          >{t("seller.logout")}</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---- mobile top bar ---- */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3 lg:hidden">
          <Logo size="sm" showWordmark={false} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-black tracking-tight">
            {user?.vendor?.business_name ?? user?.name}
          </span>
          {user?.vendor ? (
            <span
              className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-2 py-1 text-[10px] font-bold ${
                user.vendor.is_approved
                  ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                  : "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)]"
              }`}
            >
              {user.vendor.is_approved ? t("seller.verified") : t("seller.statusPending")}
            </span>
          ) : null}
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-6">{children}</main>

        {/* ---- mobile bottom nav ----
            Four destinations plus a sheet, rather than eight tabs crushed into
            a 320px bar. Everything in the sidebar is reachable from here. */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] lg:hidden">
          {NAV.filter((item) => item.primary).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold ${
                  active ? "text-[color:var(--color-brand)]" : "text-[color:var(--color-ink-muted)]"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">{item.icon}</span>
                <span className="w-full truncate text-center">{t(item.label as never)}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold text-[color:var(--color-ink-muted)]"
          >
            <span aria-hidden="true" className="text-base leading-none">☰</span>
            <span className="w-full truncate text-center">{t("seller.more")}</span>
          </button>
        </nav>

        {moreOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("seller.menu")}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] pb-[env(safe-area-inset-bottom)]">
              <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-4 py-3">
                <span className="text-sm font-extrabold">{t("seller.menu")}</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label={t("common.close")}
                  className="-mr-2 flex h-11 w-11 items-center justify-center"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <nav className="py-1">
                {NAV.filter((item) => !item.primary).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-semibold"
                  >
                    <span aria-hidden="true" className="w-5 text-center text-[color:var(--color-ink-muted)]">{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{t(item.label as never)}</span>
                  </Link>
                ))}
              </nav>

              <div className="border-t border-[color:var(--color-line)] p-4">
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); logout(); }}
                  className="flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-sm font-bold text-[color:var(--color-sale)]"
                >
                  {t("seller.logout")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
