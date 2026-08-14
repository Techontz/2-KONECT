"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import type { Category } from "@/lib/types";
import { useT } from "@/lib/i18n";

/**
 * The white category bar that sits directly under the yellow header, with a
 * hover mega-menu of subcategories — the reference storefront's primary
 * navigation.
 *
 * Categories come from the database, never a hard-coded list, so a category
 * added in the admin appears here without a code change.
 */
export function CategoryNav({ categories }: { categories: Category[] }) {
  const t = useT();
  const [openId, setOpenId] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      rail.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, categories.length]);

  // A small close delay keeps the menu open while the pointer travels from the
  // category label down into the panel.
  function openMenu(id: number) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenId(id);
  }
  function scheduleClose() {
    closeTimer.current = window.setTimeout(() => setOpenId(null), 120);
  }

  const active = categories.find((category) => category.id === openId) ?? null;

  return (
    <div
      className="relative z-40 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
      onMouseLeave={scheduleClose}
    >
      <div className="shell relative flex items-center">
        {canScrollLeft ? (
          <NavArrow side="left" onClick={() => railRef.current?.scrollBy({ left: -320, behavior: "smooth" })} />
        ) : null}

        <div ref={railRef} className="rail flex-1 gap-1 py-1.5">
          {categories.map((category) => (
            <div
              key={category.id}
              onMouseEnter={() => openMenu(category.id)}
              className="shrink-0"
            >
              <Link
                href={`/category?id=${category.id}`}
                prefetch={false}
                className={`block whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-semibold transition-colors hover:bg-[color:var(--color-surface-alt)] ${
                  openId === category.id ? "bg-[color:var(--color-surface-alt)]" : ""
                }`}
              >
                {category.name.trim()}
              </Link>
            </div>
          ))}
        </div>

        {canScrollRight ? (
          <NavArrow side="right" onClick={() => railRef.current?.scrollBy({ left: 320, behavior: "smooth" })} />
        ) : null}

        {/* Appears with the bar itself, not 256px later.
            The burger — and with it the mobile menu that carries this same
            link — is hidden from lg, so gating the CTA at xl left 1024–1279px
            with no seller entry point anywhere but the footer. */}
        <Link
          href="/sell"
          prefetch={false}
          className="ml-3 hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] border border-[color:var(--color-brand-dark)] bg-[color:var(--color-brand)] px-3 py-1.5 text-[11px] font-extrabold text-[color:var(--color-brand-ink)] transition-colors hover:bg-[color:var(--color-brand-dark)] lg:inline-flex"
        >
          {t("header.sellOn", { brand: BRAND.short })}
          <span aria-hidden="true">›</span>
        </Link>
      </div>

      {/* ---- mega menu ---- */}
      {active && active.subcategories.length > 0 ? (
        <div
          onMouseEnter={() => openMenu(active.id)}
          className="absolute inset-x-0 top-full border-b border-[color:var(--color-line)] bg-white shadow-[var(--shadow-pop)]"
        >
          <div className="shell grid grid-cols-2 gap-x-6 gap-y-1 py-5 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-full mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-extrabold">{active.name.trim()}</h3>
              <Link
                href={`/category?id=${active.id}`}
                prefetch={false}
                onClick={() => setOpenId(null)}
                className="text-xs font-bold text-[color:var(--color-action)] hover:underline"
              >
                Shop all {active.product_count} products →
              </Link>
            </div>

            {active.subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/category?id=${active.id}&subcategory=${sub.id}`}
                prefetch={false}
                onClick={() => setOpenId(null)}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-[color:var(--color-ink-muted)] transition-colors hover:bg-[color:var(--color-surface-alt)] hover:text-[color:var(--color-ink)]"
              >
                {sub.image ? (
                  <img src={sub.image} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-[var(--radius-xs)] object-cover" />
                ) : null}
                <span className="clamp-1">{sub.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavArrow({ side, onClick }: { side: "left" | "right"; onClick(): void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? t("header.previousCategories") : t("header.moreCategories")}
      className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)] md:flex ${
        side === "left" ? "mr-1" : "ml-1"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}

export default CategoryNav;
