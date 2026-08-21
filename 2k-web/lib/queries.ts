"use client";

import { peekQuery, prefetchQuery, seedQuery, useCachedQuery, writeQuery } from "./cache";
import shop, { type ProductQuery } from "./shop";
import type {
  Category,
  HomeFeed,
  ProductCard,
  ProductDetail,
  ProductListing,
  VendorSummary,
} from "./types";

/**
 * The cached read surface of the catalogue.
 *
 * Everything here is public, anonymous and identical for every visitor, which
 * is what makes it safe to keep. Anything shopper-specific — cart, orders,
 * addresses, wishlist, checkout, payment, the seller console — is absent on
 * purpose and still goes through `shop.*` directly on every call.
 *
 * The TTLs below are how long a value is served without asking the server. It
 * is never how long a wrong value can survive: past the TTL the cached copy is
 * still shown instantly and refreshed behind it, so the shopper sees the old
 * answer for one paint and the new one as soon as it lands.
 */
export const TTL = {
  /** Categories change when an administrator edits them: rare, and visible. */
  categories: 30 * 60_000,
  /** The home feed is rebuilt server-side every 5 minutes; match it. */
  home: 5 * 60_000,
  /** A category landing page: its shelves move as slowly as the catalogue. */
  category: 10 * 60_000,
  /** Listing pages carry price and stock, so they are refreshed briskly. */
  listing: 3 * 60_000,
  /** A product page's stock and price. Checkout re-checks both server-side. */
  product: 2 * 60_000,
  vendors: 15 * 60_000,
} as const;

/** A stable key for a listing query — same filters, same key, whatever the order. */
export function listingKey(query: ProductQuery): string {
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `listing:${entries.join("&")}`;
}

export const key = {
  home: "home",
  categories: "categories",
  vendors: "vendors",
  category: (id: number) => `category:${id}`,
  product: (id: number) => `product:${id}`,
  listing: listingKey,
};

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useHomeFeed(enabled = true) {
  return useCachedQuery<HomeFeed>(key.home, () => shop.home(), {
    ttl: TTL.home,
    persist: true,
    enabled,
  });
}

export function useCategories(enabled = true) {
  return useCachedQuery<Category[]>(key.categories, () => shop.categories(), {
    ttl: TTL.categories,
    persist: true,
    enabled,
  });
}

export function useVendors(enabled = true) {
  return useCachedQuery<VendorSummary[]>(key.vendors, () => shop.vendors(), {
    ttl: TTL.vendors,
    persist: true,
    enabled,
  });
}

export function useCategoryPage(id: number | null) {
  return useCachedQuery<Awaited<ReturnType<typeof shop.category>>>(
    id ? key.category(id) : null,
    () => shop.category(id as number),
    { ttl: TTL.category, persist: true },
  );
}

export function useListing(query: ProductQuery, enabled = true) {
  return useCachedQuery<ProductListing>(
    key.listing(query),
    () => shop.products(query),
    { ttl: TTL.listing, persist: true, enabled },
  );
}

export function useProduct(id: number | null) {
  return useCachedQuery<Awaited<ReturnType<typeof shop.product>>>(
    id ? key.product(id) : null,
    () => shop.product(id as number),
    { ttl: TTL.product, persist: true },
  );
}

/**
 * A listing plus however many extra pages the shopper has already asked for.
 */
export interface PagedListing extends ProductListing {
  /** How many pages are represented in `products`. */
  pages: number;
}

/**
 * The listing behind every grid on the site, with "load more" folded in.
 *
 * Holding the *accumulated* pages rather than just the first is what makes the
 * back button work properly: someone who scrolled through three pages of a
 * category, opened a product and came back used to land on a fresh page one at
 * the top of the screen. Now the same list is handed straight back, so the
 * browser's own scroll restoration has a page of the right height to restore
 * into — no scroll-position bookkeeping of our own required.
 *
 * On a background refresh only page one is re-fetched, and it is merged over
 * the head of the held list. Re-requesting every page the shopper had opened
 * would turn one quiet revalidation into four.
 */
export function usePagedListing(query: ProductQuery, enabled = true) {
  const cacheKey = key.listing(query);

  const state = useCachedQuery<PagedListing>(
    cacheKey,
    async () => {
      const held = peekQuery<PagedListing>(cacheKey, true);
      const fresh = await shop.products({ ...query, page: 1 });

      if (!held || held.pages <= 1) return { ...fresh, pages: 1 };

      const tail = held.products.slice(fresh.products.length);
      const seen = new Set(fresh.products.map((p) => p.id));
      return {
        ...fresh,
        products: [...fresh.products, ...tail.filter((p) => !seen.has(p.id))],
        pages: held.pages,
      };
    },
    { ttl: TTL.listing, persist: true, enabled },
  );

  const loadMore = async () => {
    const held = peekQuery<PagedListing>(cacheKey, true);
    if (!held?.meta.has_more) return;

    const next = await shop.products({ ...query, page: held.pages + 1 });
    const seen = new Set(held.products.map((p) => p.id));

    writeQuery(
      cacheKey,
      {
        ...next,
        products: [...held.products, ...next.products.filter((p) => !seen.has(p.id))],
        pages: held.pages + 1,
      } satisfies PagedListing,
      true,
    );
  };

  return { ...state, loadMore };
}

/* ------------------------------------------------------------------ */
/* Prefetching                                                        */
/* ------------------------------------------------------------------ */

/**
 * Warm a product's detail payload before it is opened.
 *
 * Called from a card's pointer-enter and touch-start, so it fires for the one
 * or two products a shopper is actually reaching for rather than for the
 * twenty-four on the screen. Already-cached ids cost nothing: `fetchQuery`
 * returns the held value without touching the network.
 */
export function prefetchProduct(id: number) {
  prefetchQuery(key.product(id), () => shop.product(id), {
    ttl: TTL.product,
    persist: true,
  });
}

export function prefetchListing(query: ProductQuery) {
  prefetchQuery(key.listing(query), () => shop.products(query), {
    ttl: TTL.listing,
    persist: true,
  });
}

export function prefetchCategoryPage(id: number) {
  prefetchQuery(key.category(id), () => shop.category(id), {
    ttl: TTL.category,
    persist: true,
  });
}

/**
 * Hand the product page the card the shopper just clicked.
 *
 * The grid already holds the name, price, image, rating, stock and sourcing —
 * every field above the fold on the detail page. Seeding them means the page
 * paints its headline instantly and the request behind it only has to deliver
 * the description, gallery and related shelves.
 *
 * Seeded under a separate key so it can never be mistaken for the full detail
 * response: `useProduct` still fetches, and the page reads this only while
 * that is in flight.
 */
export function seedProductPreview(card: ProductCard) {
  seedQuery(`preview:${card.id}`, card);
}

export function readProductPreview(id: number): ProductCard | null {
  return peekQuery<ProductCard>(`preview:${id}`);
}

export type { ProductDetail };
