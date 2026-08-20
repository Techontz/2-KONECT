import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * Everything a shopper can browse signed-out is indexable. Account, cart and
 * checkout are not: they are personal, they need a session, and a crawler
 * following them only produces empty pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/cart", "/checkout", "/vendor", "/user"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
