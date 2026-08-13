"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductCard as ProductCardModel } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";

/**
 * Horizontally scrolling product rail with a section header and edge arrows —
 * the repeating unit of the reference homepage.
 *
 * The arrows only appear when the row actually overflows, and they disable at
 * each end, so a short shelf never shows dead controls.
 */
export function ProductShelf({
  title,
  subtitle,
  products,
  viewAllHref,
  loading = false,
}: {
  title: string;
  subtitle?: string;
  products: ProductCardModel[];
  viewAllHref?: string;
  loading?: boolean;
}) {
  const t = useT();
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const max = rail.scrollWidth - rail.clientWidth;
    setOverflows(max > 4);
    setAtStart(rail.scrollLeft <= 4);
    setAtEnd(rail.scrollLeft >= max - 4);
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
  }, [measure, products.length, loading]);

  function scrollBy(direction: 1 | -1) {
    const rail = railRef.current;
    if (!rail) return;
    // Page by roughly a screenful, matching the reference's arrow behaviour.
    rail.scrollBy({ left: direction * rail.clientWidth * 0.85, behavior: "smooth" });
  }

  if (!loading && products.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] py-4">
      <header className="mb-3 flex items-center justify-between gap-4 px-4">
        <div className="min-w-0">
          <h2 className="text-[17px] font-extrabold tracking-tight md:text-[19px]">{title}</h2>
          {subtitle ? (
            <p className="clamp-1 text-[12px] text-[color:var(--color-ink-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            prefetch={false}
            className="shrink-0 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors hover:border-[color:var(--color-ink)]"
          >
            {t("common.viewAll")}
          </Link>
        ) : null}
      </header>

      <div className="relative">
        {overflows ? (
          <>
            <RailArrow side="left" disabled={atStart} onClick={() => scrollBy(-1)} />
            <RailArrow side="right" disabled={atEnd} onClick={() => scrollBy(1)} />
          </>
        ) : null}

        <div ref={railRef} className="rail gap-3 px-4 pb-1">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="w-[170px] shrink-0 md:w-[196px]">
                  <ProductCardSkeleton />
                </div>
              ))
            : products.map((product) => (
                <div key={product.id} className="w-[170px] shrink-0 md:w-[196px]">
                  <ProductCard product={product} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}

function RailArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick(): void;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? t("common.scrollLeft") : t("common.scrollRight")}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white shadow-[var(--shadow-card)] transition-opacity md:flex ${
        side === "left" ? "left-1" : "right-1"
      } ${disabled ? "pointer-events-none opacity-0" : "opacity-100 hover:shadow-[var(--shadow-hover)]"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}

/** Responsive product grid used by category, search and wishlist pages. */
export function ProductGrid({
  products,
  loading = false,
  skeletonCount = 12,
}: {
  products: ProductCardModel[];
  loading?: boolean;
  skeletonCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {loading
        ? Array.from({ length: skeletonCount }).map((_, index) => <ProductCardSkeleton key={index} />)
        : products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}
