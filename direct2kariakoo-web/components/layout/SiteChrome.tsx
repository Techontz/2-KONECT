"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import shop from "@/lib/shop";
import type { Category } from "@/lib/types";
import { Header } from "./Header";
import { CategoryNav } from "./CategoryNav";
import { Footer } from "./Footer";
import { AuthSheet } from "./AuthSheet";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/store/auth";
import { useVendorRedirect } from "@/lib/store/vendorRoute";
import { useLocation } from "@/lib/store/location";
import { useWishlist } from "@/lib/store/wishlist";
import { LocationPicker } from "@/components/location/LocationPicker";
import { BRAND } from "@/lib/brand";

/**
 * Everything wrapped around a storefront page: providers, header, category
 * navigation, footer and the auth sheet.
 *
 * The category tree is fetched once here and shared through context, so the
 * nav, mega menu, footer and mobile drawer all read the same data instead of
 * each issuing their own request.
 */

const CategoriesContext = createContext<Category[]>([]);
export const useCategories = () => useContext(CategoriesContext);

/**
 * Visual chrome only — the state providers live in the root layout, so a page
 * may read cart/auth/wishlist state before this ever renders.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A seller is sent to their console rather than shown the shop. This is the
  // single place it happens, because this component is what "the customer
  // experience" actually is — every storefront route composes it, and nothing
  // under /vendor does.
  const leavingForConsole = useVendorRedirect();

  useEffect(() => {
    // Pointless work for a seller who is on their way out.
    if (leavingForConsole) return;

    shop
      .categories()
      .then(setCategories)
      // A failed category fetch must not take the page down — the nav simply
      // renders empty and everything else keeps working.
      .catch(() => setCategories([]));
  }, [leavingForConsole]);

  // Hold the storefront back while the redirect lands, so a seller never sees
  // a frame of the shopping interface.
  if (leavingForConsole) {
    return <div className="min-h-screen bg-[color:var(--color-canvas)]" aria-hidden="true" />;
  }

  return (
    <CategoriesContext.Provider value={categories}>
      <div className="flex min-h-screen flex-col">
        <Header onOpenMenu={() => setDrawerOpen(true)} />

        <div className="hidden lg:block">
          <CategoryNav categories={categories} />
        </div>

        <main className="flex-1">{children}</main>

        <Footer categories={categories} />
      </div>

      <MobileMenu
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
      />

      <AuthSheet />
    </CategoriesContext.Provider>
  );
}

/**
 * The mobile menu.
 *
 * This is the whole of the site's navigation for anyone on a phone, not just
 * its category list. The header can only carry a handful of icons at 320px, so
 * everything the desktop keeps permanently on screen — the account menu, the
 * orders and wishlist actions, and the "Sell on D2K" call to action that lives
 * in the desktop category bar — has to have somewhere to go, and this is it.
 *
 * The seller entry point matters most: it was previously reachable only from
 * the desktop-only category bar or from an account dropdown that requires
 * being signed in, so a shopper on a phone had no way of discovering that they
 * could sell here at all.
 */
function MobileMenu({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose(): void;
  categories: Category[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const { location } = useLocation();
  const { user, isAuthenticated, logout, openAuthPrompt } = useAuth();
  const wishlist = useWishlist();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Escape closes it, as it does every other overlay on the site.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isVendor = user?.role === "vendor";

  return (
    <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label={t("header.menu")}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <aside className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[color:var(--color-line)] bg-[color:var(--color-brand)] px-4 py-3">
          <span className="text-sm font-extrabold">{t("header.menu")}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] hover:bg-black/5"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Who you are. Signed out, this is the sign-in prompt rather than a
              row that silently does nothing. */}
          {isAuthenticated ? (
            <Link
              href="/account"
              prefetch={false}
              onClick={onClose}
              className="flex items-center gap-3 border-b border-[color:var(--color-line)] px-4 py-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-sm font-extrabold">
                {(user?.name ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{user?.name}</span>
                <span className="block truncate text-[12px] text-[color:var(--color-ink-muted)]">{user?.email}</span>
              </span>
              <Chevron />
            </Link>
          ) : (
            <div className="border-b border-[color:var(--color-line)] px-4 py-4">
              <p className="mb-2.5 text-[13px] text-[color:var(--color-ink-muted)]">{t("header.signInHint")}</p>
              <button
                type="button"
                onClick={() => { onClose(); openAuthPrompt(); }}
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-action)] text-sm font-bold text-white"
              >
                {t("header.login")}
              </button>
            </div>
          )}

          <nav className="border-b border-[color:var(--color-line)] py-1">
            <MenuRow href="/" onClick={onClose} icon={<HomeIcon />} label={t("common.home")} />
            <MenuRow href="/account/orders" onClick={onClose} icon={<BoxIcon />} label={t("header.myOrders")} />
            <MenuRow
              href="/wishlist"
              onClick={onClose}
              icon={<HeartIcon />}
              label={t("header.wishlist")}
              badge={wishlist.count}
            />
            <MenuRow href="/account/messages" onClick={onClose} icon={<ChatIcon />} label={t("chat.inbox")} />
            {isAuthenticated ? (
              <MenuRow href="/account" onClick={onClose} icon={<UserIcon />} label={t("header.myAccount")} />
            ) : null}
          </nav>

          {/* The seller call to action. Deliberately styled as a block rather
              than another list row — on desktop it is a standing button in the
              category bar, and it should read with the same weight here. */}
          <div className="border-b border-[color:var(--color-line)] p-4">
            <Link
              href={isVendor ? "/vendor/dashboard" : "/sell"}
              prefetch={false}
              onClick={onClose}
              className="flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-3 py-2.5"
            >
              <StoreIcon />
              <span className="min-w-0 flex-1 text-sm font-extrabold">
                {isVendor ? t("header.sellerDashboard") : t("header.sellOn", { brand: BRAND.short })}
              </span>
              <Chevron />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="flex min-h-11 w-full items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3 text-left"
          >
            <PinIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
              {t("header.deliverTo")}{" "}
              <span className="font-extrabold">{location?.label ?? BRAND.city}</span>
            </span>
            <Chevron />
          </button>

          <p className="px-4 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
            {t("header.browseCategories")}
          </p>

          <nav className="pb-2">
            {categories.map((category) => (
              <div key={category.id} className="border-b border-[color:var(--color-line)] last:border-0">
                <div className="flex items-center">
                  <Link
                    href={`/category?id=${category.id}`}
                    prefetch={false}
                    onClick={onClose}
                    className="flex min-h-11 flex-1 items-center gap-3 px-4 py-3 text-sm font-semibold"
                  >
                    {category.image ? (
                      <img src={category.image} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                    ) : null}
                    <span className="clamp-1">{category.name.trim()}</span>
                  </Link>

                  {category.subcategories.length > 0 ? (
                    <button
                      type="button"
                      aria-label={`${t("header.categories")}: ${category.name}`}
                      aria-expanded={expanded === category.id}
                      onClick={() => setExpanded(expanded === category.id ? null : category.id)}
                      className="flex h-11 w-12 shrink-0 items-center justify-center text-[color:var(--color-ink-muted)]"
                    >
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${expanded === category.id ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {expanded === category.id ? (
                  <div className="bg-[color:var(--color-surface-alt)] pb-2">
                    {category.subcategories.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/category?id=${category.id}&subcategory=${sub.id}`}
                        prefetch={false}
                        onClick={onClose}
                        className="flex min-h-10 items-center py-2 pl-14 pr-4 text-[13px] text-[color:var(--color-ink-muted)]"
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>

          {isAuthenticated ? (
            <div className="border-t border-[color:var(--color-line)] p-4">
              <button
                type="button"
                onClick={() => { onClose(); logout(); }}
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-sm font-bold text-[color:var(--color-sale)]"
              >
                {t("header.logout")}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  );
}

/** One navigation row in the mobile menu, sized for a thumb. */
function MenuRow({
  href,
  label,
  icon,
  onClick,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onClick(): void;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm font-semibold"
    >
      <span className="shrink-0 text-[color:var(--color-ink-muted)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 ? (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-ink)] px-1.5 text-[11px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <Chevron />
    </Link>
  );
}

/* ---- icons ---- */
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[color:var(--color-ink-faint)]" {...line} aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function HomeIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" {...line} aria-hidden="true"><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>;
}
function BoxIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" {...line} aria-hidden="true"><path d="M3 8h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /><path d="M3 8l2-4h14l2 4M12 8v13" /></svg>;
}
function HeartIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" {...line} aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" /></svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" {...line} aria-hidden="true"><path d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z" /></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" {...line} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.9 3.6-6 8-6s8 2.1 8 6" /></svg>;
}
function StoreIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" {...line} aria-hidden="true"><path d="M4 9h16v10a1 1 0 01-1 1H5a1 1 0 01-1-1V9z" /><path d="M3 9l1.6-4.4A1 1 0 015.5 4h13a1 1 0 01.9.6L21 9" /><path d="M9 20v-5h6v5" /></svg>;
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export default SiteChrome;
