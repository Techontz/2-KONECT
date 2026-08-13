"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import type { Category, ProductCard as ProductCardModel } from "@/lib/types";
import { useT } from "@/lib/i18n";

/* ==========================================================================
   Homepage composition blocks, mirroring the reference storefront:
   a circular category rail, a "more reasons to shop" promo grid, a
   countdown-led mega-deals panel and an editorial "in focus" column.

   Promotional artwork is ours (the brief allows creative marketing assets);
   every product inside these blocks is real catalogue data.
   ========================================================================== */

/** Circular category shortcuts directly beneath the hero. */
export function CategoryRail({ categories }: { categories: Omit<Category, "subcategories">[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] py-4">
      <div className="rail gap-2 px-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/category?id=${category.id}`}
            prefetch={false}
            className="group flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-[var(--radius-sm)] p-1 text-center transition-colors hover:bg-[color:var(--color-surface-alt)]"
          >
            <span className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-surface-alt)] ring-1 ring-[color:var(--color-line)] transition-transform group-hover:scale-105">
              {category.image ? (
                <img src={category.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">{category.icon ?? "🛍️"}</span>
              )}
            </span>
            <span className="clamp-2 text-[11px] font-semibold leading-tight">
              {category.name.trim()}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Three-column band: promo tiles, a live mega-deals panel, and an editorial
 * column — the reference's densest homepage row.
 */
export function FeatureBand({
  deals,
  categories,
}: {
  deals: ProductCardModel[];
  categories: Omit<Category, "subcategories">[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
      <ReasonsToShop categories={categories} />
      <MegaDeals deals={deals} />
      <InFocus categories={categories} />
    </div>
  );
}

function ReasonsToShop({ categories }: { categories: Omit<Category, "subcategories">[] }) {
  const t = useT();
  // Promotional tiles: our own artwork and copy, each pointed at a real
  // category so the link always lands on genuine stock.
  const tiles = [
    { title: t("home.newArrivals"), subtitle: t("home.newArrivalsHint"), tone: "from-[#dbeafe] to-[#eef4ff]", href: "/search?sort=newest" },
    { title: t("home.bestSellers"), subtitle: t("home.bestSellersHint"), tone: "from-[#fde7e9] to-[#fff1f2]", href: "/search?sort=rating" },
    { title: t("home.bigSavings"), subtitle: t("home.bigSavingsHint"), tone: "from-[#fef3c7] to-[#fffbeb]", href: "/deals" },
    { title: t("home.localSellers"), subtitle: t("home.localSellersHint", { country: BRAND.country }), tone: "from-[#dcfce7] to-[#f0fdf4]", href: "/vendors" },
  ];

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      <h2 className="mb-3 text-[17px] font-extrabold tracking-tight">{t("home.moreReasons")}</h2>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile, index) => (
          <Link
            key={tile.title}
            href={tile.href}
            prefetch={false}
            className={`group flex flex-col justify-between overflow-hidden rounded-[var(--radius-md)] bg-gradient-to-br ${tile.tone} p-3 transition-shadow hover:shadow-[var(--shadow-hover)]`}
          >
            <div className="mb-6 flex h-16 items-center justify-center">
              {categories[index]?.image ? (
                <img
                  src={categories[index].image ?? ""}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 rounded-[var(--radius-sm)] object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <span className="text-4xl">{["✨", "🏆", "🔥", "🇹🇿"][index]}</span>
              )}
            </div>
            <div>
              <p className="text-[14px] font-extrabold leading-tight">{tile.title}</p>
              <p className="clamp-2 text-[11px] text-[color:var(--color-ink-muted)]">{tile.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MegaDeals({ deals }: { deals: ProductCardModel[] }) {
  const t = useT();
  const featured = deals.slice(0, 4);

  return (
    <section className="relative rounded-[var(--radius-md)] bg-[#fffbe6] p-4">
      <CountdownPill />

      <div className="mb-3 flex items-center justify-between gap-3 pt-3">
        <h2 className="text-[17px] font-extrabold tracking-tight">{t("home.megaDeals")}</h2>
        <Link
          href="/deals"
          prefetch={false}
          className="rounded-[var(--radius-sm)] bg-[color:var(--color-ink)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white"
        >
          All deals
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {featured.map((product) => (
          <Link
            key={product.id}
            href={`/product?id=${product.id}`}
            prefetch={false}
            className="group flex flex-col overflow-hidden rounded-[var(--radius-sm)] bg-white p-2 transition-shadow hover:shadow-[var(--shadow-hover)]"
          >
            {product.price.discount_percent ? (
              <span className="mb-1 self-start rounded-[var(--radius-xs)] bg-[color:var(--color-brand)] px-1.5 py-0.5 text-[10px] font-extrabold">
                {product.price.discount_percent}% off
              </span>
            ) : null}

            <div className="mb-2 aspect-square w-full overflow-hidden">
              {product.image ? (
                <img src={product.image} alt={product.name} loading="lazy"
                  className="h-full w-full object-contain transition-transform group-hover:scale-105" />
              ) : (
                <div className="h-full w-full bg-[color:var(--color-surface-alt)]" />
              )}
            </div>

            <p className="clamp-2 mb-1 text-[11px] leading-tight">{product.name}</p>
            <p className="mt-auto flex flex-wrap items-baseline gap-1.5">
              <span className="text-[13px] font-extrabold">{formatMoney(product.price.current)}</span>
              {product.price.was ? (
                <span className="text-[10px] text-[color:var(--color-ink-faint)] line-through">
                  {formatMoney(product.price.was)}
                </span>
              ) : null}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Live countdown to midnight — the reference's deal-urgency device. */
function CountdownPill() {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);

      const diff = Math.max(0, midnight.getTime() - now.getTime());
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);

      setRemaining(
        [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(" : ")
      );
    }

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Rendered only after the first client tick, so the server-rendered markup
  // and the hydrated markup can never disagree about the time.
  if (!remaining) return <div className="h-6" />;

  return (
    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-ink)] px-3 py-1 text-[12px] font-bold tabular-nums text-white">
        <span aria-hidden="true">⏳</span>
        {remaining}
      </span>
    </div>
  );
}

function InFocus({ categories }: { categories: Omit<Category, "subcategories">[] }) {
  const t = useT();
  const spotlight = categories.slice(4, 6);

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      <h2 className="mb-3 text-[17px] font-extrabold tracking-tight">{t("home.inFocus")}</h2>

      <div className="grid gap-3">
        <Link
          href="/deals"
          prefetch={false}
          className="group relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-[var(--radius-md)] bg-gradient-to-br from-[#111827] to-[#374151] p-4 text-white"
        >
          {spotlight[0]?.image ? (
            <img src={spotlight[0].image ?? ""} alt="" loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-500 group-hover:scale-105" />
          ) : null}
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand)]">
              Deal of the day
            </p>
            <p className="text-[20px] font-black leading-tight">{t("home.bigSavingsHint")}</p>
            <p className="text-[12px] opacity-80">{t("home.limitedStock")}</p>
          </div>
        </Link>

        <Link
          href="/sell"
          prefetch={false}
          className="group relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-brand)] p-4"
        >
          {spotlight[1]?.image ? (
            <img src={spotlight[1].image ?? ""} alt="" loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-500 group-hover:scale-105" />
          ) : null}
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-70">
              {t("home.forBusinesses")}
            </p>
            <p className="text-[20px] font-black leading-tight">{t("home.startSelling")}</p>
            <p className="text-[12px] opacity-80">
              {t("home.reachShoppers", { country: BRAND.country })}
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}
