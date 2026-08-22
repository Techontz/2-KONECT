import type { Metadata } from "next";

import { BRAND } from "@/lib/brand";
import { seoCategory, type SeoCategory } from "@/lib/seoSource";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import CategoryView from "./CategoryView";

/**
 * The category route.
 *
 * Server wrapper around the unchanged client page, for the same reason as the
 * product route: only a page receives `searchParams`, and without it every
 * category shipped the same `<title>Category | 2KONECT</title>`.
 *
 * A subcategory is treated as its own page rather than as a filtered view of
 * its parent — it is what most shopping searches are actually for ("phones",
 * not "electronics") and it gets its own title, description and canonical.
 * Both are real URLs the visible navigation already links.
 */

type Params = { searchParams: Promise<{ id?: string; subcategory?: string }> };

interface Resolved {
  data: SeoCategory;
  categoryId: number;
  subcategory: { id: number; name: string; product_count: number } | null;
}

async function load(searchParams: Params["searchParams"]): Promise<Resolved | null> {
  const { id, subcategory } = await searchParams;
  const categoryId = Number(id);
  if (!categoryId || Number.isNaN(categoryId)) return null;

  const data = await seoCategory(categoryId);
  if (!data) return null;

  const subId = Number(subcategory);
  const match = subId ? data.subcategories.find((s) => s.id === subId) ?? null : null;

  return { data, categoryId, subcategory: match };
}

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const resolved = await load(searchParams);

  if (!resolved) {
    return {
      title: { absolute: `Category | ${BRAND.name}` },
      description: "Browse a 2KONECT category — local stock and imported options side by side, with the delivery window on every listing.",
      robots: { index: false, follow: true },
    };
  }

  const { data, categoryId, subcategory } = resolved;
  const name = (subcategory?.name ?? data.category.name).trim();
  const count = subcategory?.product_count ?? data.subcategories.reduce((n, s) => n + s.product_count, 0);

  const canonical = subcategory
    ? `/category?id=${categoryId}&subcategory=${subcategory.id}`
    : `/category?id=${categoryId}`;

  const title = `${name} in Tanzania — buy online | ${BRAND.name}`;
  const description = describe(name, count, subcategory ? null : data.subcategories);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: BRAND.name,
      locale: "en_TZ",
      images: data.category.image
        ? [{ url: data.category.image, alt: `${name} on ${BRAND.name}` }]
        : [{ url: BRAND.logo.og, width: 1200, height: 630, alt: BRAND.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [data.category.image ?? BRAND.logo.og],
    },
  };
}

/**
 * What this category actually holds, in a sentence.
 *
 * Built from the real count and the real subcategory names, so two categories
 * never describe themselves the same way — and so the description says
 * something a shopper would recognise rather than repeating the category name
 * with keywords attached.
 */
function describe(
  name: string,
  count: number,
  subcategories: { name: string }[] | null,
): string {
  const lead = count > 0
    ? `Shop ${count.toLocaleString("en-US")} ${name.toLowerCase()} ${count === 1 ? "listing" : "listings"} on ${BRAND.name}.`
    : `Shop ${name.toLowerCase()} on ${BRAND.name}.`;

  const names = (subcategories ?? [])
    .filter((s) => s.name.trim())
    .slice(0, 4)
    .map((s) => s.name.trim().toLowerCase());

  const middle = names.length ? ` Including ${names.join(", ")}.` : "";

  return `${lead}${middle} Buy what is already in Tanzania for delivery in days, or order it from abroad and track it to your door.`;
}

export default async function CategoryPage({ searchParams }: Params) {
  const resolved = await load(searchParams);

  const products = resolved
    ? resolved.data.shelves
        .filter((shelf) => !resolved.subcategory || shelf.id === resolved.subcategory.id)
        .flatMap((shelf) => shelf.products)
    : [];

  return (
    <>
      {resolved ? (
        <>
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: resolved.data.category.name.trim(), path: `/category?id=${resolved.categoryId}` },
              ...(resolved.subcategory
                ? [{
                    name: resolved.subcategory.name.trim(),
                    path: `/category?id=${resolved.categoryId}&subcategory=${resolved.subcategory.id}`,
                  }]
                : []),
            ])}
          />
          <JsonLd
            data={itemListSchema(
              (resolved.subcategory?.name ?? resolved.data.category.name).trim(),
              products.slice(0, 30),
            )}
          />

          {/* Crawlable links to everything below this category, present in the
              first HTML response rather than after the grid has fetched. The
              visible page renders the same destinations; this only guarantees
              a crawler sees them without executing anything. */}
          <nav className="sr-only" aria-label={`${resolved.data.category.name.trim()} contents`}>
            <h2>{resolved.data.category.name.trim()}</h2>
            <ul>
              {resolved.data.subcategories.map((sub) => (
                <li key={sub.id}>
                  <a href={`/category?id=${resolved.categoryId}&subcategory=${sub.id}`}>
                    {sub.name.trim()} ({sub.product_count})
                  </a>
                </li>
              ))}
              {products.slice(0, 30).map((product) => (
                <li key={product.id}>
                  <a href={`/product?id=${product.id}`}>{product.name}</a>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : null}

      <CategoryView />
    </>
  );
}
