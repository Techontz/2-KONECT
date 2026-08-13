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
import { useLocation } from "@/lib/store/location";
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

  useEffect(() => {
    shop
      .categories()
      .then(setCategories)
      // A failed category fetch must not take the page down — the nav simply
      // renders empty and everything else keeps working.
      .catch(() => setCategories([]));
  }, []);

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

      <MobileCategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
      />

      <AuthSheet />
    </CategoriesContext.Provider>
  );
}

/** Slide-in category list for narrow screens. */
function MobileCategoryDrawer({
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
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label={t("header.allCategories")}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[color:var(--color-line)] bg-[color:var(--color-brand)] px-4 py-3">
          <span className="text-sm font-extrabold">{t("header.allCategories")}</span>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="p-1">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="flex w-full items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3 text-left"
        >
          <PinIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {t("header.deliverTo")}{" "}
            <span className="font-extrabold">{location?.label ?? BRAND.city}</span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-[color:var(--color-ink-faint)]">›</span>
        </button>

        <nav className="flex-1 overflow-y-auto py-2">
          {categories.map((category) => (
            <div key={category.id} className="border-b border-[color:var(--color-line)] last:border-0">
              <div className="flex items-center">
                <Link
                  href={`/category?id=${category.id}`}
                  prefetch={false}
                  onClick={onClose}
                  className="flex flex-1 items-center gap-3 px-4 py-3 text-sm font-semibold"
                >
                  {category.image ? (
                    <img src={category.image} alt="" loading="lazy" className="h-8 w-8 rounded-[var(--radius-sm)] object-cover" />
                  ) : null}
                  <span className="clamp-1">{category.name.trim()}</span>
                </Link>

                {category.subcategories.length > 0 ? (
                  <button
                    type="button"
                    aria-label={`Show ${category.name} subcategories`}
                    aria-expanded={expanded === category.id}
                    onClick={() => setExpanded(expanded === category.id ? null : category.id)}
                    className="px-4 py-3 text-[color:var(--color-ink-muted)]"
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
                      className="block px-4 py-2 pl-14 text-[13px] text-[color:var(--color-ink-muted)]"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </aside>

      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  );
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
