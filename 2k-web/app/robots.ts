import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * Everything a shopper can browse signed-out is indexable. Anything personal
 * is not: it needs a session, and a crawler following it only reaches an empty
 * page or a sign-in prompt.
 *
 * Two things were wrong here and both cost real pages.
 *
 * `Disallow: /vendor` is a prefix match, so it also blocked `/vendors` — the
 * public seller directory, which is a genuine landing page, is linked from the
 * footer and was listed in the sitemap at the same time. Google was being told
 * to index a URL it was simultaneously forbidden to fetch. The rule now ends
 * in a slash so it covers the seller console and nothing else, and `/vendors`
 * is allowed explicitly so the intent survives anyone editing this list.
 *
 * The sitemap line pointed at the wrong domain, because it is built from
 * SITE_URL — see lib/site.ts.
 *
 * Nothing blocks CSS, JavaScript, images or `/_next/*`: Google renders pages
 * before judging them, and a marketplace whose stylesheets are unreachable is
 * judged as an unstyled one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        // Stated outright so the seller-console rule below can never be
        // widened back over the public directory by accident.
        "/vendors",
      ],
      disallow: [
        "/account",
        "/cart",
        "/checkout",
        // The seller console. The trailing slash is load-bearing.
        "/vendor/",
        // Saved items are per-shopper and already carry noindex; there is
        // nothing here for a crawler to spend its budget on.
        "/wishlist",
        // Reserved: no such route today, but a crawler should never spend
        // budget discovering one. `/login` and `/register` are deliberately
        // absent — this site has no such pages (both 404), and listing routes
        // that do not exist only makes the file harder to trust later.
        "/admin",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
