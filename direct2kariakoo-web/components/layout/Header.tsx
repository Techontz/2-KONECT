"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import shop from "@/lib/shop";
import { useAuth } from "@/lib/store/auth";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLocation } from "@/lib/store/location";
import { LocationPicker } from "@/components/location/LocationPicker";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * The yellow utility header from the reference storefront: wordmark, delivery
 * location, a dominant search field, then account / orders / wishlist / cart
 * actions on the right.
 *
 * It is sticky, because the reference keeps search reachable at any scroll
 * depth, and it collapses to a two-row layout on narrow screens rather than
 * squeezing the search field into nothing.
 */
export function Header({ onOpenMenu }: { onOpenMenu?(): void }) {
  const router = useRouter();
  const { user, isAuthenticated, logout, openAuthPrompt } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
  const t = useT();
  const { location } = useLocation();
  const [locationOpen, setLocationOpen] = useState(false);

  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof shop.suggest>> | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Debounced type-ahead. 250ms is short enough to feel instant and long
  // enough that typing a word does not fire a request per keystroke.
  useEffect(() => {
    if (term.trim().length < 2) {
      setSuggestions(null);
      return;
    }

    const timer = window.setTimeout(() => {
      shop
        .suggest(term.trim())
        .then(setSuggestions)
        .catch(() => setSuggestions(null));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [term]);

  useOutsideClick(searchRef, () => setShowSuggestions(false));
  useOutsideClick(accountRef, () => setAccountOpen(false));

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="sticky top-0 z-50 bg-[color:var(--color-brand)]">
      {/* Single row only from lg. At tablet widths the wordmark, location,
          language control and five actions no longer leave the search field a
          usable width, so search drops to its own full-width row. */}
      <div className="shell flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 lg:flex-nowrap">
        {/* Burger — mobile only; the category bar handles this on desktop.
            It opens the full mobile menu, not just categories, because on a
            phone this is the only way to reach orders, the wishlist, the
            account and "Sell on D2K". */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("header.menu")}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-brand-ink)] hover:bg-black/5 lg:hidden"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center"
          aria-label={t("header.homeAria", { brand: BRAND.name })}
        >
          <Wordmark />
        </Link>

        {/* Opens the one shared location picker — the same component checkout
            uses, so there is a single delivery-location model. */}
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="hidden shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-1 text-[13px] font-semibold text-[color:var(--color-brand-ink)] hover:bg-black/5 md:inline-flex"
        >
          <PinIcon className="h-4 w-4 shrink-0" />
          <span className="max-w-[150px] truncate">
            {t("header.deliverTo")}{" "}
            <span className="font-extrabold">{location?.label ?? BRAND.city}</span>
          </span>
          <ChevronIcon className="h-3.5 w-3.5 shrink-0" />
        </button>

        {/* Search — the widest element in the bar, exactly as in the reference. */}
        <div ref={searchRef} className="relative order-last w-full flex-1 lg:order-none lg:w-auto">
          <form onSubmit={submitSearch} role="search">
            <div className="flex h-10 items-center gap-2 rounded-[var(--radius-pill)] bg-white px-4 shadow-[var(--shadow-card)]">
              <SearchIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]" />
              <input
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t("header.searchPlaceholder")}
                aria-label="Search products"
                className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[color:var(--color-ink-faint)]"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => { setTerm(""); setSuggestions(null); }}
                  aria-label="Clear search"
                  className="shrink-0 text-[color:var(--color-ink-faint)] hover:text-[color:var(--color-ink)]"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </form>

          {showSuggestions && suggestions &&
          (suggestions.products.length > 0 || suggestions.categories.length > 0) ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-[var(--radius-md)] bg-white shadow-[var(--shadow-pop)]">
              {suggestions.categories.length > 0 ? (
                <div className="border-b border-[color:var(--color-line)] p-2">
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                    {t("header.categories")}
                  </p>
                  {suggestions.categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/category?id=${category.id}`}
                      prefetch={false}
                      onClick={() => setShowSuggestions(false)}
                      className="block rounded-[var(--radius-sm)] px-2 py-1.5 text-sm hover:bg-[color:var(--color-surface-alt)]"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="p-2">
                {suggestions.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/product?id=${product.id}`}
                    prefetch={false}
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm hover:bg-[color:var(--color-surface-alt)]"
                  >
                    <span className="clamp-1">{product.name}</span>
                    <span className="shrink-0 text-xs font-bold text-[color:var(--color-ink-muted)]">
                      {formatMoney(product.price)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* ---- actions ---- */}
        <nav className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <LanguageSwitcher />

          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => (isAuthenticated ? setAccountOpen((open) => !open) : openAuthPrompt())}
              aria-label={isAuthenticated ? t("header.account") : t("header.login")}
              className="flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-semibold text-[color:var(--color-brand-ink)] hover:bg-black/5"
            >
              <UserIcon className="h-5 w-5" />
              <span className="hidden max-w-[110px] truncate lg:inline">
                {isAuthenticated ? user?.name.split(" ")[0] : t("header.login")}
              </span>
            </button>

            {accountOpen && isAuthenticated ? (
              <div className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-[var(--radius-md)] bg-white py-1 shadow-[var(--shadow-pop)]">
                <p className="border-b border-[color:var(--color-line)] px-4 py-2 text-xs text-[color:var(--color-ink-muted)]">
                  {t("header.account")}<br />
                  <span className="font-bold text-[color:var(--color-ink)]">{user?.email}</span>
                </p>
                <MenuLink href="/account" onClick={() => setAccountOpen(false)}>{t("header.myAccount")}</MenuLink>
                <MenuLink href="/account/orders" onClick={() => setAccountOpen(false)}>{t("header.myOrders")}</MenuLink>
                <MenuLink href="/wishlist" onClick={() => setAccountOpen(false)}>{t("header.wishlist")}</MenuLink>
                <MenuLink href="/account/messages" onClick={() => setAccountOpen(false)}>{t("chat.inbox")}</MenuLink>
                {user?.role === "vendor" ? (
                  <MenuLink href="/vendor/dashboard" onClick={() => setAccountOpen(false)}>
                    {t("header.sellerDashboard")}
                  </MenuLink>
                ) : (
                  <MenuLink href="/sell" onClick={() => setAccountOpen(false)}>{t("header.sellOn", { brand: BRAND.short })}</MenuLink>
                )}
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); logout(); }}
                  className="block w-full border-t border-[color:var(--color-line)] px-4 py-2 text-left text-sm text-[color:var(--color-sale)] hover:bg-[color:var(--color-surface-alt)]"
                >
                  {t("header.logout")}
                </button>
              </div>
            ) : null}
          </div>

          {/* Orders and the wishlist are desktop-only *here* — on a phone they
              are rows in the mobile menu instead. Five icon actions plus the
              burger, the wordmark and a language control do not fit a 320px
              bar without every one of them becoming too small to hit, and the
              cart is the one that has to stay. */}
          <HeaderAction
            href="/account/orders"
            label={t("header.orders")}
            icon={<BoxIcon className="h-5 w-5" />}
            display="hidden lg:flex"
          />
          <HeaderAction
            href="/wishlist"
            label={t("header.wishlist")}
            icon={<HeartIcon className="h-5 w-5" />}
            badge={wishlist.count}
            display="hidden lg:flex"
          />
          <HeaderAction
            href="/cart"
            label={t("header.cart")}
            icon={<CartIcon className="h-5 w-5" />}
            badge={cart.count}
          />
        </nav>
      </div>

      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
    </header>
  );
}

function Wordmark() {
  return (
    <span className="flex items-baseline text-[22px] font-black leading-none tracking-tight text-[color:var(--color-brand-ink)] md:text-[26px]">
      {BRAND.wordmark.lead}
      <span className="opacity-70">{BRAND.wordmark.tail}</span>
    </span>
  );
}

function HeaderAction({
  href,
  label,
  icon,
  badge = 0,
  display = "flex",
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  /** Owns the display utility outright, so `hidden` never has to out-rank a
      `flex` baked into the shared class — that collision resolves by
      stylesheet order rather than by what is written here. */
  display?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      className={`relative min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-semibold text-[color:var(--color-brand-ink)] hover:bg-black/5 ${display}`}
    >
      <span className="relative">
        {icon}
        {badge > 0 ? (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-ink)] px-1 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick(): void }) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      className="block px-4 py-2 text-sm hover:bg-[color:var(--color-surface-alt)]"
    >
      {children}
    </Link>
  );
}

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [ref, handler]);
}

/* ---- icons ---- */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SearchIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
}
function PinIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
function UserIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.9 3.6-6 8-6s8 2.1 8 6" /></svg>;
}
function BoxIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M3 8h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /><path d="M3 8l2-4h14l2 4M12 8v13" /></svg>;
}
function HeartIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" /></svg>;
}
function CartIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /><path d="M2 3h3l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L22 7H6" /></svg>;
}
function MenuIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}
function ChevronIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}
function CloseIcon({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

export default Header;
