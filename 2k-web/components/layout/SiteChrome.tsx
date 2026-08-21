"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";

import { BRAND } from "@/lib/brand";
import { useCategories as useCategoryTree } from "@/lib/queries";
import type { Category } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useLocation } from "@/lib/store/location";
import { useVendorRedirect } from "@/lib/store/vendorRoute";
import { useWishlist } from "@/lib/store/wishlist";
import { LocationPicker } from "@/components/location/LocationPicker";
import { Logo } from "@/components/brand/Logo";
import { AuthSheet } from "./AuthSheet";
import { CategoryNav } from "./CategoryNav";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MobileTabBar } from "./MobileTabBar";

/**
 * Everything wrapped around a storefront page: header, category navigation,
 * mobile menu, bottom tab bar, footer and the auth sheet.
 *
 * The category tree is read once here and shared through context, so the nav,
 * mega menu, footer and mobile drawer all use the same data instead of each
 * issuing their own request.
 *
 * "Once" now means once per session rather than once per page. This component
 * is remounted by every storefront route, so a `useEffect` fetch here meant
 * the same 11kB category tree was downloaded again on the way to the category
 * page, again on the product page and again on the way back — four times in a
 * journey where nothing about it had changed. It is cached instead, and only
 * refreshed in the background after half an hour.
 */

/** Stable identity, so an empty nav does not re-render every consumer. */
const EMPTY_CATEGORIES: Category[] = [];

const CategoriesContext = createContext<Category[]>([]);
export const useCategories = () => useContext(CategoriesContext);

/**
 * Visual chrome only — the state providers live in the root layout, so a page
 * may read cart/auth/wishlist state before this ever renders.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A seller is sent to their console rather than shown the shop. This is the
  // single place it happens, because this component is what "the customer
  // experience" actually is — every storefront route composes it, and nothing
  // under /vendor does.
  const leavingForConsole = useVendorRedirect();

  // A failed category fetch must not take the page down — the nav simply
  // renders empty and everything else keeps working. `enabled` stands the
  // request down entirely for a seller who is on their way to the console.
  const categories = useCategoryTree(!leavingForConsole).data ?? EMPTY_CATEGORIES;

  // Hold the storefront back while the redirect lands, so a seller never sees
  // a frame of the shopping interface.
  if (leavingForConsole) {
    return <div className="min-h-screen bg-[color:var(--color-canvas)]" aria-hidden="true" />;
  }

  return (
    <CategoriesContext.Provider value={categories}>
      {/* Skip link: the first stop for a keyboard, ahead of a header full of
          category links on every single page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[color:var(--color-brand)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen flex-col">
        <Header onOpenMenu={() => setDrawerOpen(true)} />

        <div className="hidden lg:block">
          <CategoryNav categories={categories} />
        </div>

        <main id="main" className="flex-1">{children}</main>

        <Footer categories={categories} />
      </div>

      <MobileTabBar />

      <MobileMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} categories={categories} />

      <AuthSheet />
    </CategoriesContext.Provider>
  );
}

/**
 * The mobile menu.
 *
 * This is the whole of the site's navigation on a phone, not just its category
 * list. The bottom bar carries the five destinations a thumb reaches for; this
 * carries everything else — the two ways to buy, the sourcing desk, the seller
 * pitch, the account rows and the full category tree.
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
    <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="fade-in absolute inset-0 bg-black/55" onClick={onClose} />

      <aside className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white">
        <div className="brand-ground flex items-center justify-between px-4 py-4">
          <Logo tone="dark" size="md" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-white hover:bg-white/10"
          >
            <CloseIcon className="h-5 w-5" />
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-sm font-extrabold text-[color:var(--color-brand)]">
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
              <p className="mb-2.5 text-[13px] text-[color:var(--color-ink-muted)]">
                Sign in to track orders, save items and check out faster.
              </p>
              <button
                type="button"
                onClick={() => { onClose(); openAuthPrompt(); }}
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] text-sm font-bold text-white"
              >
                Sign in
              </button>
            </div>
          )}

          {/* The two ways to buy, given the space they deserve. */}
          <div className="grid grid-cols-2 gap-2 border-b border-[color:var(--color-line)] p-4">
            <Link
              href="/shop/local"
              prefetch={false}
              onClick={onClose}
              className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--color-local-line)] bg-[color:var(--color-local-soft)] p-3"
            >
              <span aria-hidden="true" className="text-[18px]">🇹🇿</span>
              <span className="text-[13px] font-extrabold text-[color:var(--color-local)]">In Tanzania</span>
              <span className="text-[11px] text-[color:var(--color-ink-muted)]">Ready in 1–3 days</span>
            </Link>
            <Link
              href="/shop/abroad"
              prefetch={false}
              onClick={onClose}
              className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[color:var(--color-import-line)] bg-[color:var(--color-import-soft)] p-3"
            >
              <span aria-hidden="true" className="text-[18px]">🌍</span>
              <span className="text-[13px] font-extrabold text-[color:var(--color-import)]">From abroad</span>
              <span className="text-[11px] text-[color:var(--color-ink-muted)]">Lower price, we import it</span>
            </Link>
          </div>

          <nav className="border-b border-[color:var(--color-line)] py-1">
            <MenuRow href="/" onClick={onClose} icon={<HomeIcon />} label="Home" />
            <MenuRow href="/request" onClick={onClose} icon={<SearchIcon />} label="Request a product" />
            <MenuRow href="/track" onClick={onClose} icon={<PinIcon />} label="Track an order" />
            <MenuRow href="/account/orders" onClick={onClose} icon={<BoxIcon />} label="My orders" />
            <MenuRow href="/wishlist" onClick={onClose} icon={<HeartIcon />} label="Saved items" badge={wishlist.count} />
            <MenuRow href="/account/messages" onClick={onClose} icon={<ChatIcon />} label="Messages" />
            <MenuRow href="/deals" onClick={onClose} icon={<TagIcon />} label="Deals" />
          </nav>

          <nav className="border-b border-[color:var(--color-line)] py-1">
            <MenuRow
              href={isVendor ? "/vendor/dashboard" : "/sell"}
              onClick={onClose}
              icon={<StoreIcon />}
              label={isVendor ? "Seller console" : `Sell with ${BRAND.name}`}
            />
            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] hover:bg-[color:var(--color-surface-alt)]"
            >
              <span className="text-[color:var(--color-ink-muted)]"><PinIcon /></span>
              <span className="min-w-0 flex-1">
                Deliver to{" "}
                <span className="font-bold">{location?.label ?? BRAND.city}</span>
              </span>
              <Chevron />
            </button>
          </nav>

          {/* ---- categories ---- */}
          <div className="py-1">
            <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              Categories
            </p>
            {categories.map((category) => {
              const isOpen = expanded === category.id;

              return (
                <div key={category.id} className="border-b border-[color:var(--color-line)] last:border-0">
                  <div className="flex items-stretch">
                    <Link
                      href={`/category?id=${category.id}`}
                      prefetch={false}
                      onClick={onClose}
                      className="min-w-0 flex-1 px-4 py-3 text-[14px] hover:bg-[color:var(--color-surface-alt)]"
                    >
                      <span className="block truncate">{category.name.trim()}</span>
                    </Link>
                    {category.subcategories.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : category.id)}
                        aria-label={`${isOpen ? "Hide" : "Show"} ${category.name.trim()} subcategories`}
                        aria-expanded={isOpen}
                        className="flex w-12 shrink-0 items-center justify-center text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)]"
                      >
                        <Chevron className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <ul className="bg-[color:var(--color-surface-alt)] py-1">
                      {category.subcategories.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/search?subcategory_id=${sub.id}`}
                            prefetch={false}
                            onClick={onClose}
                            className="block truncate py-2.5 pl-8 pr-4 text-[13px] text-[color:var(--color-ink-soft)]"
                          >
                            {sub.name.trim()}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>

          {isAuthenticated ? (
            <div className="border-t border-[color:var(--color-line)] p-4">
              <button
                type="button"
                onClick={() => { onClose(); logout(); }}
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-sm font-bold text-[color:var(--color-sale)]"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  );
}

function MenuRow({
  href,
  onClick,
  icon,
  label,
  badge = 0,
}: {
  href: string;
  onClick(): void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 text-[14px] hover:bg-[color:var(--color-surface-alt)]"
    >
      <span className="text-[color:var(--color-ink-muted)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 ? (
        <span className="rounded-full bg-[color:var(--color-brand)] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      <Chevron />
    </Link>
  );
}

/* ---- icons ---- */

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function Chevron({ className = "h-4 w-4 shrink-0 text-[color:var(--color-ink-faint)]" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M9 6l6 6-6 6" /></svg>;
}
function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
function HomeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-6h-5v6H5a1 1 0 01-1-1v-9.5z" /></svg>;
}
function BoxIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M21 8.2L12 3 3 8.2v7.6L12 21l9-5.2V8.2z" /><path d="M3 8.2l9 5.2 9-5.2M12 13.4V21" /></svg>;
}
function HeartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" /></svg>;
}
function ChatIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1121 12z" /></svg>;
}
function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>;
}
function PinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}
function TagIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M3 12.5V4h8.5L21 13.5 13.5 21 3 12.5z" /><circle cx="7.5" cy="8" r="1.4" /></svg>;
}
function StoreIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M4 9.5V20a1 1 0 001 1h14a1 1 0 001-1V9.5" /><path d="M3 5h18l-1 4.5a3 3 0 01-5.6.6 3 3 0 01-5.6 0 3 3 0 01-5.6-.6L3 5z" /></svg>;
}
