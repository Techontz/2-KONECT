import type { Metadata } from "next";

import { BRAND } from "./brand";

/**
 * Per-route metadata.
 *
 * Every page on this storefront is a client component — they all read live
 * catalogue data — so none of them can export `metadata` itself. Each route
 * therefore gets a thin server `layout.tsx` that calls this, which is the
 * App Router's own answer to exactly that situation.
 *
 * Without it every page in the site shipped the same title and description,
 * which is one search result for a marketplace with forty of them.
 */
export function pageMeta({
  title,
  description,
  path,
  index = true,
  followOnly = false,
}: {
  /** Without the brand — the root layout's template appends it. */
  title: string;
  description: string;
  /** Site-relative, for the canonical URL. Omit for a page that has no single one. */
  path?: string;
  /** False for anything personal: an account page indexed is a dead result. */
  index?: boolean;
  /**
   * Keep the page out of the index but let a crawler follow its links.
   *
   * For search results: `/search?q=` accepts any string, so leaving it
   * indexable invites Google to index an unbounded set of near-identical
   * pages, each thinner than the category page covering the same products.
   * The links on it are still worth following — they lead to real products —
   * which is why this is separate from `index: false`, whose `nofollow` is
   * right for a personal page and wrong here.
   */
  followOnly?: boolean;
}): Metadata {
  // Absolute rather than relying on the root template. Nesting a layout under
  // another one makes which template applies ambiguous, and a route already
  // named after the brand ("Sell with 2KONECT") would come out saying it
  // twice. Composing it here means the tab reads the same everywhere.
  const full = title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;

  return {
    title: { absolute: full },
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    robots: followOnly
      ? { index: false, follow: true }
      : index
        ? { index: true, follow: true }
        : { index: false, follow: false },
    openGraph: {
      title: full,
      description,
      ...(path ? { url: path } : {}),
      siteName: BRAND.name,
      type: "website",
      locale: "en_TZ",
      images: [{ url: BRAND.logo.og, width: 1200, height: 630, alt: BRAND.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [BRAND.logo.og],
    },
  };
}
