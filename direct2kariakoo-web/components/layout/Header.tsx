"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import shop from "@/lib/shop";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/store/auth";
import { useCart } from "@/lib/store/cart";
import { useLocation } from "@/lib/store/location";
import { useWishlist } from "@/lib/store/wishlist";
import { LocationPicker } from "@/components/location/LocationPicker";
import { LogoLink } from "@/components/brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * The storefront header.
 *
 * Three bands on a desktop — a thin utility strip carrying the two ways to
 * buy, then the search bar, then categories (rendered separately) — and two
 * rows on a phone, where search gets a line of its own rather than being
 * squeezed between eight icons.
 *
 * White rather than purple: a saturated bar over a page of product photography
 * fights the products for attention. The brand shows up in the mark, in the
 * actions, and in the deep utility strip above.
 */
export function Header({ onOpenMenu }: { onOpenMenu?(): void }) {
  const router = useRouter();
  const { user, isAuthenticated, logout, openAuthPrompt } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
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
      shop.suggest(term.trim()).then(setSuggestions).catch(() => setSuggestions(null));
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

  const noResults =
    showSuggestions &&
    suggestions !== null &&
    term.trim().length >= 2 &&
    suggestions.products.length === 0 &&
    suggestions.categories.length === 0;

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      {/* ---- utility strip: the two ways to buy, stated up front ---- */}
      <div className="hidden bg-[color:var(--color-brand-deep)] text-white lg:block">
        <div className="shell flex h-9 items-center gap-5 text-[12px] font-semibold">
          <Link href="/shop/local" prefetch={false} className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100">
            <span aria-hidden="true">🇹🇿</span> Available in Tanzania
          </Link>
          <Link href="/shop/abroad" prefetch={false} className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100">
            <span aria-hidden="true">🌍</span> Order from abroad
          </Link>
          <Link href="/request" prefetch={false} className="opacity-90 hover:opacity-100">
            Request a product
          </Link>

          <span className="ml-auto flex items-center gap-5">
            <Link href="/track" prefetch={false} className="opacity-90 hover:opacity-100">
              Track order
            </Link>
            <Link href="/sell" prefetch={false} className="opacity-90 hover:opacity-100">
              Sell with {BRAND.name}
            </Link>
            <Link href="/help" prefetch={false} className="opacity-90 hover:opacity-100">
              Help
            </Link>
            <LanguageSwitcher tone="dark" />
          </span>
        </div>
      </div>

      {/* ---- main bar ---- */}
      <div className="shell flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 lg:flex-nowrap lg:gap-x-5 lg:py-3">
        {/* The burger is the whole of the site's navigation on a phone, so it
            leads rather than hiding behind the logo. */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)] lg:hidden"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <LogoLink size="md" className="shrink-0" />

        {/* Opens the one shared location picker — the same component checkout
            uses, so there is a single delivery-location model. */}
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="hidden shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-alt)] xl:inline-flex"
        >
          <PinIcon className="h-4 w-4 shrink-0 text-[color:var(--color-brand)]" />
          <span className="max-w-[150px] truncate text-left leading-tight">
            <span className="block text-[10px] uppercase tracking-wide text-[color:var(--color-ink-faint)]">
              Deliver to
            </span>
            <span className="block font-bold">{location?.label ?? BRAND.city}</span>
          </span>
          <ChevronIcon className="h-3.5 w-3.5 shrink-0" />
        </button>

        {/* Search — the widest element in the bar, and on its own row below
            the logo at phone widths so it never shrinks to a stub. */}
        {/* `basis-full` is what actually forces the wrap: `flex-1` sets a zero
            basis, so a plain `w-full` would let the field shrink onto the
            first row and be clipped rather than dropping below it. */}
        <div ref={searchRef} className="relative order-last w-full basis-full lg:order-none lg:w-auto lg:flex-1 lg:basis-auto">
          <form onSubmit={submitSearch} role="search">
            <div className="flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface-alt)] pl-4 pr-1.5 transition-colors focus-within:border-[color:var(--color-brand)] focus-within:bg-white">
              <SearchIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]" />
              <input
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search products, brands and categories"
                aria-label="Search products"
                className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-[color:var(--color-ink-faint)]"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => { setTerm(""); setSuggestions(null); }}
                  aria-label="Clear search"
                  className="shrink-0 px-1 text-[color:var(--color-ink-faint)] hover:text-[color:var(--color-ink)]"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="submit"
                aria-label="Search"
                className="hidden h-8 shrink-0 items-center rounded-[var(--radius-pill)] bg-[color:var(--color-brand)] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[color:var(--color-brand-strong)] sm:flex"
              >
                Search
              </button>
            </div>
          </form>

          {showSuggestions && suggestions &&
          (suggestions.products.length > 0 || suggestions.categories.length > 0) ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white shadow-[var(--shadow-pop)]">
              {suggestions.categories.length > 0 ? (
                <div className="border-b border-[color:var(--color-line)] p-2">
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                    Categories
                  </p>
                  {suggestions.categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/category?id=${category.id}`}
                      prefetch={false}
                      onClick={() => setShowSuggestions(false)}
                      className="block rounded-[var(--radius-sm)] px-2 py-2 text-sm hover:bg-[color:var(--color-surface-alt)]"
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
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-2 text-sm hover:bg-[color:var(--color-surface-alt)]"
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

          {/* Nothing found is not a dead end here — it is the entry point to
              the sourcing desk, which is a product rather than an apology. */}
          {noResults ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-4 shadow-[var(--shadow-pop)]">
              <p className="text-[13px] font-bold">No match for “{term.trim()}”.</p>
              <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                We can source it for you from abroad.
              </p>
              <Link
                href={`/request?name=${encodeURIComponent(term.trim())}`}
                prefetch={false}
                onClick={() => setShowSuggestions(false)}
                className="mt-2.5 inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-3.5 text-[13px] font-bold text-white"
              >
                Request this product
              </Link>
            </div>
          ) : null}
        </div>

        {/* ---- actions ---- */}
        <nav aria-label="Account and cart" className="ml-auto flex shrink-0 items-center gap-0.5 lg:gap-1">
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => (isAuthenticated ? setAccountOpen((open) => !open) : openAuthPrompt())}
              aria-label={isAuthenticated ? "Your account" : "Sign in"}
              aria-expanded={isAuthenticated ? accountOpen : undefined}
              className="flex h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[13px] font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)]"
            >
              <UserIcon className="h-5 w-5" />
              <span className="hidden max-w-[110px] truncate lg:inline">
                {isAuthenticated ? user?.name.split(" ")[0] : "Sign in"}
              </span>
            </button>

            {accountOpen && isAuthenticated ? (
              <div className="fade-in absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white py-1 shadow-[var(--shadow-pop)]">
                <p className="border-b border-[color:var(--color-line)] px-4 py-2.5 text-xs text-[color:var(--color-ink-muted)]">
                  Signed in as
                  <br />
                  <span className="font-bold text-[color:var(--color-ink)]">{user?.email}</span>
                </p>
                <MenuLink href="/account" onClick={() => setAccountOpen(false)}>My account</MenuLink>
                <MenuLink href="/account/orders" onClick={() => setAccountOpen(false)}>My orders</MenuLink>
                <MenuLink href="/account/requests" onClick={() => setAccountOpen(false)}>My requests</MenuLink>
                <MenuLink href="/wishlist" onClick={() => setAccountOpen(false)}>Saved items</MenuLink>
                <MenuLink href="/account/messages" onClick={() => setAccountOpen(false)}>Messages</MenuLink>
                {user?.role === "vendor" ? (
                  <MenuLink href="/vendor/dashboard" onClick={() => setAccountOpen(false)}>Seller console</MenuLink>
                ) : (
                  <MenuLink href="/sell" onClick={() => setAccountOpen(false)}>Sell with {BRAND.name}</MenuLink>
                )}
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); logout(); }}
                  className="block w-full border-t border-[color:var(--color-line)] px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--color-sale)] hover:bg-[color:var(--color-surface-alt)]"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>

          {/* Orders and saved items are desktop-only here — on a phone they
              are rows in the menu and tabs in the bottom bar. Eight icon
              actions do not fit a 320px bar without every one of them
              becoming too small to hit, and the cart is the one that stays. */}
          <HeaderAction href="/account/orders" label="Orders" icon={<BoxIcon className="h-5 w-5" />} display="hidden lg:flex" />
          <HeaderAction href="/wishlist" label="Saved items" icon={<HeartIcon className="h-5 w-5" />} badge={wishlist.count} display="hidden lg:flex" />
          <HeaderAction href="/cart" label="Cart" icon={<CartIcon className="h-5 w-5" />} badge={cart.count} />
        </nav>
      </div>

      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
    </header>
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
      aria-label={badge > 0 ? `${label} (${badge})` : label}
      className={`relative h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)] ${display}`}
    >
      {icon}
      {badge > 0 ? (
        <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--color-brand)] px-1 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick(): void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      className="block px-4 py-2.5 text-sm hover:bg-[color:var(--color-surface-alt)]"
    >
      {children}
    </Link>
  );
}

/** Close a popover when the next click lands outside it. */
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside]);
}

/* ---- icons ---- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

function MenuIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}
function SearchIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>;
}
function CloseIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
function UserIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0115 0" /></svg>;
}
function CartIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M3 4h2.2l2.3 11.2a2 2 0 002 1.6h7.6a2 2 0 002-1.55L21 8H6.2" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17.5" cy="20" r="1.4" /></svg>;
}
function HeartIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" /></svg>;
}
function BoxIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M21 8.2L12 3 3 8.2v7.6L12 21l9-5.2V8.2z" /><path d="M3 8.2l9 5.2 9-5.2M12 13.4V21" /></svg>;
}
function PinIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}
function ChevronIcon({ className = "" }: { className?: string }) {
  return <svg {...stroke} className={className}><path d="M6 9l6 6 6-6" /></svg>;
}
