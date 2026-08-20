"use client";

import { useEffect, useState } from "react";

import shop from "@/lib/shop";
import type { HomeFeed } from "@/lib/types";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Hero } from "@/components/home/Hero";
import {
  CategoryRail,
  HowImportsWork,
  PromoStrip,
  RequestBand,
  SellBand,
} from "@/components/home/HomeSections";
import { CategoryCollection } from "@/components/home/CategoryCollection";
import { ProductShelf } from "@/components/product/ProductShelf";
import { Button, EmptyState } from "@/components/ui/Primitives";

/**
 * Homepage.
 *
 * Composed from interchangeable blocks rather than one long hand-written page.
 * The running order lives in `sections` below, so changing what the homepage
 * looks like is editing a list, not untangling JSX.
 *
 * The order is deliberate: say what 2KONECT is, prove it with the two kinds of
 * shelf side by side, explain the unfamiliar half, then let the catalogue take
 * over. Every product, category and photo is real data from a single
 * `/shop/home` request, and nothing here requires a login.
 */
export default function HomePage() {
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
        <div className="shell py-6">
          <EmptyState
            title="We couldn’t load the storefront"
            message="Check your connection and try again. If this keeps happening, our team is already on it."
            action={<Button onClick={() => window.location.reload()}>Try again</Button>}
          />
        </div>
      </SiteChrome>
    );
  }

  const loading = feed === null;
  const shelves = feed?.shelves ?? [];
  const collections = feed?.collections ?? [];
  const promos = feed?.promos ?? [];

  const sections: React.ReactNode[] = [];

  // The two ways to buy lead, because the difference between them is the
  // product. Local first: it is the faster promise and the easier sell.
  sections.push(
    <ProductShelf
      key="local"
      eyebrow={<><span aria-hidden="true">🇹🇿</span> In stock now</>}
      accent="local"
      title="Available in Tanzania"
      subtitle="Ready to ship — delivered in days, not weeks."
      products={feed?.local ?? []}
      viewAllHref="/shop/local"
      loading={loading}
    />,
  );

  sections.push(
    <ProductShelf
      key="imports"
      eyebrow={<><span aria-hidden="true">🌍</span> Sourced worldwide</>}
      accent="import"
      title="Order from abroad"
      subtitle="Lower prices. We import it and track it all the way in."
      products={feed?.imports ?? []}
      viewAllHref="/shop/abroad"
      loading={loading}
    />,
  );

  sections.push(<HowImportsWork key="how" />);

  sections.push(
    <ProductShelf
      key="deals"
      accent="brand"
      eyebrow="Best savings"
      title="Today’s deals"
      subtitle="The biggest price drops across the catalogue."
      products={feed?.deals ?? []}
      viewAllHref="/deals"
      loading={loading}
    />,
  );

  sections.push(<PromoStrip key="promo-0" banner={promos[0]} />);

  if ((feed?.verified.length ?? 0) > 0) {
    sections.push(
      <ProductShelf
        key="verified"
        accent="brand"
        eyebrow="Checked by us"
        title="From verified sellers"
        subtitle="Businesses we have reviewed and approved."
        products={feed?.verified ?? []}
        viewAllHref="/shop?verified=1"
      />,
    );
  }

  sections.push(<RequestBand key="request" />);

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

    if (index === 1 && promos[1]) {
      sections.push(<PromoStrip key="promo-1" banner={promos[1]} />);
    }
  });

  if (loading) {
    sections.push(
      ...[0, 1].map((index) => <ProductShelf key={`skeleton-${index}`} title="" products={[]} loading />),
    );
  }

  sections.push(<SellBand key="sell" />);

  return (
    <SiteChrome>
      {/* pb-tabbar keeps the last section clear of the phone navigation bar. */}
      <div className="shell space-y-5 py-4 pb-tabbar sm:space-y-6">
        <Hero
          categories={feed?.categories ?? []}
          banner={feed?.hero?.[0] ?? feed?.hero_side ?? null}
          loading={loading}
        />

        <CategoryRail categories={feed?.categories ?? []} loading={loading} />

        {sections}
      </div>
    </SiteChrome>
  );
}
