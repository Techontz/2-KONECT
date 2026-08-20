"use client";

import Link from "next/link";

import { formatMoney } from "@/lib/format";
import type { HeroBanner, ProductCard as ProductCardModel } from "@/lib/types";
import { Skeleton } from "@/components/ui/Primitives";

/* ==========================================================================
   The three-column discovery row, directly beneath the categories.

   This is the shape the reference screenshots use, and the reason their
   homepage reads as a marketplace rather than a landing page: after the
   category strip you do not fall into one endless product grid, you land on
   three compact modules that each offer a different way in — reasons to shop,
   the best prices right now, and whatever is being featured.

   It collapses to one column on a phone in the order a thumb wants them.
   ========================================================================== */

export function ModuleRow({
  deals,
  promos,
  loading = false,
}: {
  deals: ProductCardModel[];
  promos: HeroBanner[];
  loading?: boolean;
}) {
  return (
    <div className="section grid gap-3 lg:h-[540px] lg:grid-cols-3">
      <ReasonsToShop />
      <DealsModule deals={deals} loading={loading} />
      <Spotlight promos={promos} loading={loading} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Four ways in, as tiles rather than sentences.
 *
 * Each one is a real filtered listing, not a marketing page: the two halves
 * of the marketplace, the fast window, and the sourcing desk.
 */
function ReasonsToShop() {
  const tiles = [
    {
      href: "/shop/local",
      flag: "🇹🇿",
      title: "Already in Tanzania",
      note: "Ready to ship",
      className: "bg-[color:var(--color-local-soft)] text-[color:var(--color-local)]",
    },
    {
      href: "/shop/abroad",
      flag: "🌍",
      title: "From abroad",
      note: "Lower prices",
      className: "bg-[color:var(--color-import-soft)] text-[color:var(--color-import)]",
    },
    {
      href: "/shop?max_days=3",
      flag: "⚡",
      title: "Need it fast",
      note: "Within 3 days",
      className: "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand)]",
    },
    {
      href: "/request",
      flag: "🔎",
      title: "Can’t find it?",
      note: "We’ll source it",
      className: "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)]",
    },
  ];

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <h2 className="mb-3 shrink-0 text-[17px] font-extrabold tracking-[-0.02em] text-[color:var(--color-brand)]">
        More reasons to shop
      </h2>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 lg:auto-rows-fr">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            prefetch={false}
            className={`flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] p-3 text-center transition-transform hover:-translate-y-0.5 ${tile.className}`}
          >
            <span aria-hidden="true" className="text-[30px] leading-none">{tile.flag}</span>
            <span>
              <span className="block text-[13px] font-extrabold leading-tight">{tile.title}</span>
              {/* No opacity here: fading the tone against its own tinted
                  ground took these under 4.5:1. Hierarchy comes from size
                  and weight instead, which costs no contrast. */}
              <span className="mt-0.5 block text-[11.5px] font-semibold">{tile.note}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The four deepest real price drops.
 *
 * No countdown and no "ends tonight": the catalogue records a discount, not a
 * campaign window, so a timer here would be invented. The saving is the whole
 * story and it is a true number.
 */
function DealsModule({ deals, loading }: { deals: ProductCardModel[]; loading: boolean }) {
  const shown = deals.filter((product) => product.badges.discounted).slice(0, 4);

  if (!loading && shown.length === 0) return null;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-brand-50)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-[color:var(--color-brand)]">
          2KONECT Deals
        </h2>
        <Link
          href="/deals"
          prefetch={false}
          className="tap shrink-0 rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[color:var(--color-brand-strong)]"
        >
          Shop deals
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 lg:auto-rows-fr">
        {loading
          ? [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-[168px] rounded-[var(--radius-sm)]" />)
          : shown.map((product) => (
              <Link
                key={product.id}
                href={`/product?id=${product.id}`}
                prefetch={false}
                className="group flex min-h-0 flex-col rounded-[var(--radius-sm)] bg-white p-2 transition-shadow hover:shadow-[var(--shadow-card)]"
              >
                <span className="relative block min-h-0 flex-1 overflow-hidden rounded-[var(--radius-xs)]">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                  {product.price.discount_percent ? (
                    <span className="absolute left-0 top-0 rounded-[var(--radius-xs)] bg-[color:var(--color-sale)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      −{product.price.discount_percent}%
                    </span>
                  ) : null}
                </span>

                <span className="clamp-1 mt-1.5 text-[11.5px] leading-[15px] text-[color:var(--color-ink-soft)]">
                  {product.name}
                </span>

                <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[13.5px] font-extrabold leading-none text-[color:var(--color-ink)]">
                    {formatMoney(product.price.current)}
                  </span>
                  {product.price.was ? (
                    <span className="text-[10.5px] leading-none text-[color:var(--color-ink-faint)] line-through">
                      {formatMoney(product.price.was)}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Whatever is being featured — two campaign plates, stacked.
 *
 * Real `banners` rows with placement `promo`, so this column is edited from
 * the admin panel rather than from here.
 */
function Spotlight({ promos, loading }: { promos: HeroBanner[]; loading: boolean }) {
  // Three, at the plate's own aspect. Cropping a 3:1 campaign into a 2:1 cell
  // cut the headline at every anchor, so the cell matches the artwork instead
  // and the column simply carries one more plate.
  const shown = promos.filter((banner) => banner.image).slice(0, 3);

  if (!loading && shown.length === 0) return null;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <h2 className="mb-3 shrink-0 text-[17px] font-extrabold tracking-[-0.02em] text-[color:var(--color-brand)]">
        2KONECT Spotlight
      </h2>

      <div className="grid min-h-0 flex-1 content-start gap-2.5">
        {loading
          ? [0, 1, 2].map((index) => (
              <Skeleton key={index} className="aspect-[1200/400] rounded-[var(--radius-sm)]" />
            ))
          : shown.map((banner) => (
              <Link
                key={banner.id}
                href={banner.link ?? "/shop"}
                prefetch={false}
                className="group block overflow-hidden rounded-[var(--radius-sm)]"
                aria-label={banner.title ?? undefined}
              >
                <img
                  src={banner.image as string}
                  alt={banner.alt ?? banner.title ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[1200/400] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </Link>
            ))}
      </div>
    </section>
  );
}

export default ModuleRow;
