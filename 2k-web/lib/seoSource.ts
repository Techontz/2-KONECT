import { SITE_URL } from "./site";

/**
 * Server-side reads of the catalogue, for metadata and the sitemap.
 *
 * Deliberately separate from `lib/shop.ts`: that client is built for the
 * browser — it carries an auth interceptor, reads localStorage for a token and
 * rewrites loopback hostnames against `window.location`. None of that applies
 * on a server, and `window` does not exist there.
 *
 * Everything here uses `fetch` with Next's own cache, so a page rendered for a
 * crawler costs one origin request per revalidation window rather than one per
 * visit. That matters more than usual here: the production API answers in
 * about three seconds, so an uncached metadata fetch would be three seconds
 * added to every server render.
 */

/** The API origin, as the server sees it — never rewritten for a browser. */
export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
}

async function get<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // A metadata fetch must never take a page down. The caller falls back to
    // generic copy, which is worse for search but still a working page.
    return null;
  }
}

export interface SitemapSource {
  products: { id: number; updated_at: string | null }[];
  categories: { id: number; updated_at: string | null }[];
  subcategories: { id: number; category_id: number; updated_at: string | null }[];
  vendors: { id: number; updated_at: string | null }[];
}

/** Ids and timestamps for every indexable catalogue URL. */
export function sitemapSource() {
  return get<SitemapSource>("/shop/sitemap", 1800);
}

export interface SeoProduct {
  id: number;
  name: string;
  short_description: string | null;
  description: string | null;
  image: string | null;
  images: string[];
  price: { currency: string; current: number; was: number | null };
  stock: number;
  in_stock: boolean;
  category: { id: number; name: string } | null;
  subcategory: { id: number; name: string } | null;
  vendor: { id: number; name: string } | null;
  rating: { average: number; count: number };
  sourcing?: { is_local?: boolean; origin?: { name?: string } | null };
  variant_summary: {
    price_from: number;
    price_to: number;
    is_range: boolean;
    stock: number;
    in_stock: boolean;
  } | null;
  variants: { id: number; sku: string | null; price: { current: number }; stock: number; in_stock: boolean }[];
}

export function seoProduct(id: number) {
  return get<{ product: SeoProduct }>(`/shop/products/${id}`, 300).then((data) => data?.product ?? null);
}

export interface SeoCategory {
  category: { id: number; name: string; image: string | null };
  subcategories: { id: number; name: string; product_count: number }[];
  shelves: { id: number; title: string; products: { id: number; name: string }[] }[];
}

export function seoCategory(id: number) {
  return get<SeoCategory>(`/shop/categories/${id}`, 600);
}

export function seoVendors() {
  return get<{ vendors: { id: number; name: string; product_count: number }[] }>("/shop/vendors", 900);
}

/** Absolute URL for a site-relative path — used by metadata and JSON-LD. */
export function abs(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
