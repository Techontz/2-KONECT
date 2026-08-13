"use client";

import { useEffect, useState } from "react";
import shop from "@/lib/shop";
import type { HomeFeed } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { HeroBanner } from "@/components/home/HeroBanner";
import { AdSlot, PromoBanner } from "@/components/home/PromoBanner";
import { CategoryCollection } from "@/components/home/CategoryCollection";
import { CategoryRail, FeatureBand } from "@/components/home/HomeSections";
import { ProductShelf } from "@/components/product/ProductShelf";
import { Button, EmptyState } from "@/components/ui/Primitives";

/**
 * Homepage.
 *
 * Composed from interchangeable blocks — hero, category rail, product row,
 * category collection, promotional strip — rather than one long hand-written
 * page. The running order lives in `sections` below, so changing what the
 * homepage looks like is editing a list, not untangling JSX.
 *
 * Every product, category and photo is real catalogue data from a single
 * `/shop/home` request, and nothing here requires a login.
 */
export default function HomePage() {
  const t = useT();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    shop
      .home()
      .then((data) => { if (!cancelled) setFeed(data); })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <SiteChrome>
        <div className="shell py-3">
          <EmptyState
            title={t("home.loadFailed")}
            message={t("home.loadFailedHint")}
            action={<Button onClick={() => window.location.reload()}>{t("common.retry")}</Button>}
          />
        </div>
      </SiteChrome>
    );
  }

  const loading = feed === null;
  const shelves = feed?.shelves ?? [];
  const collections = feed?.collections ?? [];
  const promos = feed?.promos ?? [];

  /**
   * The homepage running order.
   *
   * Product rows and category collections are interleaved with promotional
   * strips so the page never becomes an unbroken wall of product cards. A
   * section that has no data returns null and simply does not appear — an
   * empty "Beauty" heading is worse than no heading.
   */
  const sections: React.ReactNode[] = [];

  // Today's deals lead, because a discount is the strongest reason to stop.
  sections.push(
    <ProductShelf
      key="deals"
      title={t("home.dealsTitle")}
      subtitle={t("home.dealsSubtitle")}
      products={feed?.deals ?? []}
      viewAllHref="/deals"
      loading={loading}
    />,
  );

  sections.push(<PromoBanner key="promo-0" banner={promos[0]} />);

  // Then the catalogue itself: a product row, then a way to browse the same
  // category visually, alternating so the two never stack monotonously.
  shelves.forEach((shelf, index) => {
    sections.push(
      <ProductShelf
        key={`shelf-${shelf.id}`}
        title={shelf.title.trim()}
        products={shelf.products}
        viewAllHref={`/category?id=${shelf.id}`}
      />,
    );

    const collection = collections[index];
    if (collection) {
      sections.push(<CategoryCollection key={`collection-${collection.id}`} collection={collection} />);
    }

    // Remaining promotional strips are spread through the page rather than
    // bunched at the end.
    if (index === 1 && promos[1]) {
      sections.push(<PromoBanner key="promo-1" banner={promos[1]} />);
    }
    if (index === 3) {
      sections.push(<AdSlot key="ad-mid" id="home-mid" />);
    }
  });

  if (loading) {
    sections.push(
      ...[0, 1].map((index) => <ProductShelf key={`skeleton-${index}`} title="" products={[]} loading />),
    );
  }

  // The seller pitch closes the page: by here a visitor has seen what the
  // marketplace carries, which is the moment "sell on D2K" lands.
  sections.push(<PromoBanner key="promo-last" banner={promos[2]} />);

  return (
    <SiteChrome>
      <div className="shell space-y-6 py-3">
        <HeroBanner slides={feed?.hero ?? []} side={feed?.hero_side ?? null} loading={loading} />

        <CategoryRail categories={feed?.categories ?? []} />

        {feed ? (
          <FeatureBand deals={feed.deals} categories={feed.categories} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-[340px] rounded-[var(--radius-md)]" />
            ))}
          </div>
        )}

        {sections}
      </div>
    </SiteChrome>
  );
}
