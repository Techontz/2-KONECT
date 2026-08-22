"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { country as lookupCountry } from "@/lib/countries";
import shop from "@/lib/shop";
import type { Country, ProductCard as ProductCardType } from "@/lib/types";
import { ProductCard } from "@/components/product/ProductCard";
import { Skeleton } from "@/components/ui/Primitives";
import { SectionHead } from "@/components/home/SectionHead";

/* ==========================================================================
   Discovery — the ways into the catalogue that are not a category.

   Every block here is driven by a facet the API already computes, so a
   country, a delivery window or a saving appears because the catalogue
   contains it, not because it was typed into a list. A country with nothing
   behind it is never rendered.
   ========================================================================== */

/**
 * Shop by country.
 *
 * The section that makes 2KONECT read as an import business rather than a
 * local shop. Counts and codes come from the `origins` facet; Tanzania is
 * dropped because it is the other half of the model and has its own entrance.
 */
export function ShopByCountry({ origins: all }: { origins: (Country & { count: number })[] | null }) {
  const t = useT();
  const origins = (all ?? []).filter((origin) => origin.code !== "TZ" && origin.count > 0);

  if (origins.length === 0) return null;

  return (
    <section className="section" aria-labelledby="by-country">
      <SectionHead
        id="by-country"
        eyebrow={t("home.sourcedWorldwide")}
        title={t("home.shopByCountry")}
        subtitle={t("home.shopByCountryHint")}
        href="/shop/abroad"
        linkLabel={t("home.allImports")}
      />

      <div className="rail bleed gap-3">
        {origins.map((source) => {
          const meta = lookupCountry(source.code);
          return (
            <Link
              key={source.code}
              href={`/shop/abroad?country=${source.code}`}
              prefetch={false}
              className="group flex w-[168px] shrink-0 flex-col justify-between rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-4 transition-all hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-hover)] sm:w-[190px]"
            >
              <span className="text-[30px] leading-none" aria-hidden="true">{meta.flag}</span>
              <span className="mt-3 block text-[15px] font-extrabold leading-tight text-[color:var(--color-brand)]">
                {meta.name}
              </span>
              {meta.hub ? (
                <span className="mt-0.5 block text-[12px] text-[color:var(--color-ink-faint)]">
                  via {meta.hub}
                </span>
              ) : null}
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--color-import)]">
                {source.count.toLocaleString()} {source.count === 1 ? "product" : "products"}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Shop by delivery time.
 *
 * Four real windows, each one a `max_days` query the catalogue can answer.
 * The counts are fetched rather than assumed: a window with nothing inside it
 * would be a promise 2KONECT cannot keep, so it is not offered.
 */
/**
 * The four windows.
 *
 * Chosen against the live catalogue rather than picked as round numbers: at
 * 3, 10, 14 and 45 days each threshold returns a genuinely different set,
 * because everything held in Tanzania arrives in 1–3 days and the air-freight
 * routes land at 5–9, 8–14 and 9–16. A "within 7 days" tile would have
 * returned exactly the same products as "within 3", which is a distinction
 * that wastes a click.
 *
 * The counts are still fetched, not hard-coded — these are the thresholds,
 * not the answers, and the answers move as the catalogue does.
 */
const WINDOWS = [
  { days: 3,  title: "home.needItNow",     window: null, note: "home.needItNowNote" },
  { days: 10, title: "home.nextWeek",      window: 10,   note: "home.nextWeekNote" },
  { days: 14, title: "home.worthTheWait",  window: 14,   note: "home.worthTheWaitNote" },
  { days: 45, title: "home.bestPrice",     window: 45,   note: "home.bestPriceNote" },
] as const;

/**
 * The counts arrive with the home feed.
 *
 * This section used to fetch its own, one request per window, each asking the
 * listing endpoint for a single row purely to read the paginator's total —
 * four round trips to put four numbers on the screen. The catalogue answers
 * all four in one grouped query now, inside the payload the page was already
 * waiting for.
 */
export function ShopByDelivery({ counts }: { counts: Record<number, number> | null }) {
  const t = useT();
  const shown = WINDOWS.filter((w) => counts === null || (counts[w.days] ?? 0) > 0);
  if (counts !== null && shown.length === 0) return null;

  return (
    <section className="section" aria-labelledby="by-speed">
      <SectionHead
        id="by-speed"
        eyebrow={t("home.howeverFast")}
        title={t("home.shopByDelivery")}
        subtitle={t("home.shopByDeliveryHint")}
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {shown.map((w) => (
          <Link
            key={w.days}
            href={`/shop?max_days=${w.days}`}
            prefetch={false}
            className="group rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white p-4 transition-all hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-hover)]"
          >
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              {t(w.title)}
            </span>
            <span className="mt-1.5 block text-[19px] font-extrabold leading-none tracking-[-0.02em] text-[color:var(--color-brand)] sm:text-[22px]">
              {w.window === null ? t("home.daysRange") : t("home.upToDays", { days: w.window })}
            </span>
            <span className="mt-1.5 block text-[12px] leading-snug text-[color:var(--color-ink-muted)]">
              {t(w.note)}
            </span>
            <span className="mt-3 block text-[12px] font-bold text-[color:var(--color-brand)]">
              {counts === null ? (
                <Skeleton className="h-3.5 w-20" />
              ) : (
                <>
                  {(counts[w.days] ?? 0).toLocaleString()} products{" "}
                  <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ==========================================================================
   Recently viewed
   ========================================================================== */

const RECENT_KEY = "2konect.recent";
const RECENT_MAX = 12;

/** Records a product id as seen. Called by the product page. */
export function rememberProduct(id: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...ids.filter((existing) => existing !== id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A full or disabled localStorage must not break a product page.
  }
}

/**
 * A detail payload, narrowed to what a card renders.
 *
 * The detail and card endpoints return the same product in two shapes; this
 * is the one place that converts between them, so <ProductCard> keeps a
 * single input type and the row cannot drift from the grid.
 */
function cardFromDetail(payload: Awaited<ReturnType<typeof shop.product>>): ProductCardType {
  const detail = payload.product;
  return {
    id: detail.id,
    name: detail.name,
    image: detail.image,
    images: detail.images,
    price: detail.price,
    rating: { average: detail.rating.average, count: detail.rating.count },
    stock: detail.stock,
    in_stock: detail.in_stock,
    category: detail.category ?? undefined,
    subcategory: detail.subcategory ?? undefined,
    vendor: detail.vendor
      ? { id: detail.vendor.id, name: detail.vendor.name, is_verified: detail.vendor.is_verified }
      : undefined,
    sourcing: detail.sourcing,
    badges: {
      low_stock: detail.in_stock && detail.stock > 0 && detail.stock <= 5,
      out_of_stock: !detail.in_stock,
      discounted: Boolean(detail.price.was && detail.price.was > detail.price.current),
    },
  };
}

/**
 * Products this browser has actually opened.
 *
 * Held on the device, not on the server: there is no per-user view history in
 * the backend, and inventing one on the client and calling it personalisation
 * would be a lie. This is honestly "what you looked at on this device", and it
 * re-fetches each product so the price and stock are current rather than
 * whatever they were at the time.
 */
export function RecentlyViewed() {
  const t = useT();
  const [products, setProducts] = useState<ProductCardType[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    let ids: number[] = [];
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      ids = raw ? JSON.parse(raw) : [];
    } catch {
      ids = [];
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      setProducts([]);
      return;
    }

    Promise.all(
      ids.slice(0, RECENT_MAX).map((id) =>
        shop
          .product(id)
          .then(cardFromDetail)
          // A product that has since been delisted simply drops out of the
          // row rather than leaving a broken tile behind.
          .catch(() => null),
      ),
    ).then((cards) => {
      if (!cancelled) setProducts(cards.filter((c): c is ProductCardType => Boolean(c)));
    });

    return () => { cancelled = true; };
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <section className="section" aria-labelledby="recent">
      <SectionHead id="recent" title={t("home.recentlyViewed")} subtitle={t("home.recentlyViewedHint")} />
      <div className="rail bleed gap-2.5">
        {products.map((product) => (
          <div key={product.id} className="w-[164px] shrink-0 sm:w-[200px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ==========================================================================
   Trust
   ========================================================================== */

/**
 * The promise, in four parts.
 *
 * Every line is something the system genuinely does — an admin approves each
 * seller, every order carries a reference, every step is recorded, and nobody
 * pays before the price is agreed. No certifications, no badges we did not
 * issue, no guarantees the software cannot keep.
 */
export function TrustBand() {
  const t = useT();
  const facts = [
    { title: t("home.knowWhere"), note: t("home.knowWhereNote") },
    { title: t("home.knowCost"), note: t("home.knowCostNote") },
    { title: t("home.knowWhen"), note: t("home.knowWhenNote") },
    { title: t("home.checkedSellers"), note: t("home.checkedSellersNote", { brand: BRAND.name }) },
  ];

  return (
    <section className="section brand-ground overflow-hidden rounded-[var(--radius-lg)]" aria-labelledby="trust">
      <div className="px-5 py-8 sm:px-8 sm:py-10">
        <h2 id="trust" className="max-w-xl text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-white sm:text-[30px]">
          {t("home.trustTitle")}
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/70">
          {t("home.trustSubtitle")}
        </p>

        <dl className="mt-7 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.title} className="border-t border-white/20 pt-3.5">
              <dt className="text-[14px] font-extrabold text-white">{fact.title}</dt>
              <dd className="mt-1.5 text-[12.5px] leading-relaxed text-white/65">{fact.note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
