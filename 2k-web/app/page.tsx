import type { Metadata } from "next";

import { BRAND } from "@/lib/brand";
import { organizationSchema, websiteSchema } from "@/lib/schema";
import { seoCategory, sitemapSource } from "@/lib/seoSource";
import { JsonLd } from "@/components/seo/JsonLd";
import HomeView from "./HomeView";

/**
 * The homepage.
 *
 * A server wrapper around the unchanged client page. It carries the two blocks
 * that tell Google what this site *is* — the organisation behind it and the
 * site's own search — plus a crawlable list of every category, so the
 * catalogue is reachable from the first HTML response rather than only after
 * the grid has fetched and hydrated.
 *
 * The interface, the cached home feed and every bit of the navigation
 * behaviour still live in HomeView and are untouched.
 */

const description =
  "2KONECT is Tanzania's online marketplace. Buy what is already in the country for delivery in days, or order it from abroad at a lower price and track it all the way to your door.";

export const metadata: Metadata = {
  // The homepage carries the brand and what the brand does, because this is
  // the result someone searching "2KONECT" will see.
  title: { absolute: `${BRAND.name} — Tanzania's Online Marketplace` },
  description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: `${BRAND.name} — Tanzania's Online Marketplace`,
    description,
    url: "/",
    siteName: BRAND.name,
    locale: "en_TZ",
    images: [{ url: BRAND.logo.og, width: 1200, height: 630, alt: BRAND.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — Tanzania's Online Marketplace`,
    description,
    images: [BRAND.logo.og],
  },
};

export default async function HomePage() {
  // Category names for the crawlable index below. Best-effort: if the API is
  // unreachable the page renders exactly as before, minus this block.
  const source = await sitemapSource();
  const categories = source
    ? (
        await Promise.all(
          source.categories.slice(0, 20).map(async (row) => {
            const detail = await seoCategory(row.id);
            return detail
              ? {
                  id: row.id,
                  name: detail.category.name.trim(),
                  subcategories: detail.subcategories.map((s) => ({ id: s.id, name: s.name.trim() })),
                }
              : null;
          }),
        )
      ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />

      {/* The route into the catalogue, as plain links.
          The visible homepage links the same destinations through its category
          rail — this is the same set expressed without needing JavaScript to
          run, so a crawler reaches every category and subcategory on the first
          response. It is hidden from sight because the rail is what a person
          should actually use. */}
      {categories.length ? (
        <nav className="sr-only" aria-label="All categories">
          <h2>Shop by category on {BRAND.name}</h2>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>
                <a href={`/category?id=${category.id}`}>{category.name}</a>
                {category.subcategories.length ? (
                  <ul>
                    {category.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <a href={`/category?id=${category.id}&subcategory=${sub.id}`}>{sub.name}</a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <HomeView />
    </>
  );
}
