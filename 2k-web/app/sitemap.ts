import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { sitemapSource } from "@/lib/seoSource";

/**
 * The public surface of the storefront.
 *
 * It listed eighteen static routes and nothing else — no products, no
 * categories, no sellers — on the reasoning that a crawler would find them by
 * following links. That is true in principle and slow in practice: a
 * marketplace with 2,858 products was handing Google eighteen URLs and asking
 * it to discover the rest by walking a JavaScript grid.
 *
 * Every indexable catalogue URL is listed now, built from ids the API returns
 * in one request rather than hardcoded, so it grows and shrinks with the
 * catalogue on its own.
 *
 * Deliberately absent: cart, checkout, account, orders, the seller console,
 * saved items, and every filtered listing URL. A filter is a view of a page
 * that is already here — `/shop?availability=import&max_days=10` is not a
 * separate thing to index, and listing the combinations would bury the real
 * pages under thousands of near-duplicates.
 *
 * If the API cannot be reached the static routes are still returned, so a
 * transient failure degrades to the sitemap this file used to produce rather
 * than to an empty one — an empty sitemap tells Google the site has no pages.
 */
export const revalidate = 1800;

type Entry = MetadataRoute.Sitemap[number];

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: Entry["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" },
  { path: "/shop/local", priority: 0.9, changeFrequency: "daily" },
  { path: "/shop/abroad", priority: 0.9, changeFrequency: "daily" },
  { path: "/categories", priority: 0.8, changeFrequency: "weekly" },
  { path: "/deals", priority: 0.8, changeFrequency: "daily" },
  { path: "/request", priority: 0.8, changeFrequency: "monthly" },
  { path: "/sell", priority: 0.8, changeFrequency: "monthly" },
  { path: "/track", priority: 0.7, changeFrequency: "monthly" },
  { path: "/vendors", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help/delivery", priority: 0.4, changeFrequency: "monthly" },
  { path: "/help/returns", priority: 0.4, changeFrequency: "monthly" },
  { path: "/help/contact", priority: 0.4, changeFrequency: "monthly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly" },
];

/** A timestamp the sitemap can use, or today if the row has none. */
function when(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const source = await sitemapSource();
  if (!source) return entries;

  for (const category of source.categories) {
    entries.push({
      url: `${SITE_URL}/category?id=${category.id}`,
      lastModified: when(category.updated_at, now),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // A subcategory is a real destination — it is what most shopping searches
  // are actually for — and it is reached by a query on the category page it
  // belongs to, which is the URL the visible navigation already links.
  for (const sub of source.subcategories) {
    entries.push({
      url: `${SITE_URL}/category?id=${sub.category_id}&subcategory=${sub.id}`,
      lastModified: when(sub.updated_at, now),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const vendor of source.vendors) {
    entries.push({
      url: `${SITE_URL}/vendors?id=${vendor.id}`,
      lastModified: when(vendor.updated_at, now),
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  for (const product of source.products) {
    entries.push({
      url: `${SITE_URL}/product?id=${product.id}`,
      lastModified: when(product.updated_at, now),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
