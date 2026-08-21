"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/lib/store/cart";

/**
 * The phone navigation bar.
 *
 * Most of this marketplace's traffic is a thumb on a handset, so the five
 * destinations that matter live permanently within reach of it rather than
 * behind a burger. Every target clears 44px and the bar respects the home
 * indicator inset, so nothing sits under the system gesture area.
 *
 * Pages add `pb-tabbar` to their trailing padding so no content is ever
 * parked underneath this.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const cart = useCart();

  const tabs = [
    { href: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
    { href: "/shop", label: "Shop", icon: GridIcon, match: (p: string) => p.startsWith("/shop") || p.startsWith("/category") || p.startsWith("/search") },
    { href: "/cart", label: "Cart", icon: CartIcon, badge: cart.count, match: (p: string) => p.startsWith("/cart") },
    { href: "/account/orders", label: "Orders", icon: BoxIcon, match: (p: string) => p.startsWith("/account/orders") || p.startsWith("/track") },
    { href: "/account", label: "Account", icon: UserIcon, match: (p: string) => p === "/account" || p.startsWith("/account/") },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
    >
      <ul className="flex h-[62px] items-stretch">
        {tabs.map((tab) => {
          // "Orders" must not also light up on /account, so the more specific
          // tab is asked first and the account tab excludes what it claimed.
          const active =
            tab.href === "/account"
              ? pathname === "/account" ||
                (pathname.startsWith("/account/") && !pathname.startsWith("/account/orders"))
              : tab.match(pathname);

          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                // The bottom bar is how a phone gets around this site. Five
                // links, five routes, all of them likely — worth having their
                // chunks in hand before the tap.
                prefetch
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${
                  active ? "text-[color:var(--color-brand)]" : "text-[color:var(--color-ink-muted)]"
                }`}
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" active={active} />
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-brand)] px-1 text-[9px] leading-none text-white">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  ) : null}
                </span>
                {tab.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[color:var(--color-brand)]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Icons fill when the tab is active, so the current place reads at a glance
   rather than relying on colour alone. */
type IconProps = { className?: string; active?: boolean };

function glyph(active?: boolean) {
  return {
    viewBox: "0 0 24 24",
    fill: active ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: active ? 0.8 : 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function HomeIcon({ className, active }: IconProps) {
  return (
    <svg {...glyph(active)} className={className}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-6h-5v6H5a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}
function GridIcon({ className, active }: IconProps) {
  return (
    <svg {...glyph(active)} className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}
function CartIcon({ className, active }: IconProps) {
  return (
    <svg {...glyph(active)} className={className}>
      <path d="M3 4h2.2l2.3 11.2a2 2 0 002 1.6h7.6a2 2 0 002-1.55L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}
function BoxIcon({ className, active }: IconProps) {
  return (
    <svg {...glyph(active)} className={className}>
      <path d="M21 8.2L12 3 3 8.2v7.6L12 21l9-5.2V8.2z" />
      {!active ? <path d="M3 8.2l9 5.2 9-5.2M12 13.4V21" /> : null}
    </svg>
  );
}
function UserIcon({ className, active }: IconProps) {
  return (
    <svg {...glyph(active)} className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0115 0z" />
    </svg>
  );
}
