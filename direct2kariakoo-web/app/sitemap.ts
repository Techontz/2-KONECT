import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * The public surface of the storefront.
 *
 * Static routes only. Product and category URLs are query-string driven and
 * number in the thousands, so listing them here would produce a sitemap that
 * is mostly duplicate-content noise; the category and listing pages link them
 * for a crawler to follow instead.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
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

  const now = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
