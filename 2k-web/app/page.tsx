"use client";

import { useEffect, useState } from "react";

import { BRAND } from "@/lib/brand";
import shop from "@/lib/shop";
import type { HomeFeed, ListingFilters } from "@/lib/types";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { BannerRow } from "@/components/home/BannerRow";
import { ModuleRow } from "@/components/home/ModuleRow";
import {
  CategoryRail,
  HowImportsWork,
  PromoStrip,
  RequestBand,
  SellBand,
} from "@/components/home/HomeSections";
import { CategoryCollection } from "@/components/home/CategoryCollection";
import {
  RecentlyViewed,
  ShopByCountry,
  ShopByDelivery,
  TrustBand,
} from "@/components/home/Discovery";
import { ProductShelf } from "@/components/product/ProductShelf";
import { Button, EmptyState } from "@/components/ui/Primitives";

/**
 * Homepage.
 *
 * Composed from interchangeable blocks rather than one long hand-written page.
 * The running order lives in `sections` below, so changing what the homepage
 * looks like is editing a list, not untangling JSX.
 *
 * The order is a marketplace's, not a landing page's: campaign, categories,
 * three ways in, then shelf after shelf of real stock. Nothing at the top
 * explains the business in prose — the two ways to buy are permanent fixtures
 * in the utility strip, the category bar and every product card, so the first
 * screen can be spent on things to buy instead of on an introduction.
 *
 * Every product, category and banner is real data from a single `/shop/home`
 * request, and nothing here requires a login.
 */
export default function HomePage() {
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [filters, setFilters] = useState<ListingFilters | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    shop
      .home()
      .then((data) => { if (!cancelled) setFeed(data); })
      .catch(() => { if (!cancelled) setFailed(true); });

    // The catalogue's own facets, for "shop by country". One row is requested
    // because only the facet block is wanted, not the products — and the
    // section renders nothing at all if this fails, rather than a country list
    // that is not backed by stock.
    shop
      .products({ per_page: 1 })
      .then((listing) => { if (!cancelled) setFilters(listing.filters); })
      .catch(() => undefined);

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

  // The two shelves have shown what the difference is; this explains the half
  // nobody has done before, then opens the door to every source country.
  sections.push(<HowImportsWork key="how" />);

  sections.push(<ShopByCountry key="countries" filters={filters} />);

  sections.push(<ShopByDelivery key="speed" />);

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

  sections.push(<RecentlyViewed key="recent" />);

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
      // The third plate: the spotlight column above has already used the
      // first two, and the same campaign twice on one page reads as a bug.
      sections.push(<PromoStrip key="promo-2" banner={promos[2]} />);
    }
  });

  if (loading) {
    sections.push(
      ...[0, 1].map((index) => <ProductShelf key={`skeleton-${index}`} title="" products={[]} loading />),
    );
  }

  sections.push(<TrustBand key="trust" />);

  // The seller pitch comes last and small. It is the one block on this page
  // addressed to somebody who is not shopping, and it used to open the page.
  sections.push(<SellBand key="sell" />);

  return (
    <SiteChrome>
      {/* pb-tabbar keeps the last section clear of the phone navigation bar. */}
      <div className="shell py-3 pb-tabbar sm:py-4">
        {/* The page needs exactly one h1, and the design deliberately has no
            page title — a marketplace opens with stock, not a headline. So the
            document's heading is given to assistive technology and to search
            engines without taking a line of the layout. It is not decoration:
            without it this page had no h1 at all once the old hero went. */}
        <h1 className="sr-only">
          {BRAND.name} — buy what is already in Tanzania, or order it from abroad
        </h1>

        <BannerRow
          main={feed?.hero ?? []}
          side={feed?.hero_side ?? null}
          loading={loading}
        />

        {/* Categories sit directly under the campaign, where a marketplace
            puts them — one swipe from the top of the page on a phone. */}
        <div className="mt-3">
          <CategoryRail categories={feed?.categories ?? []} loading={loading} />
        </div>

        <ModuleRow deals={feed?.deals ?? []} promos={promos} loading={loading} />

        {sections}
      </div>
    </SiteChrome>
  );
}
