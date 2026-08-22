import type { Metadata } from "next";

import { BRAND } from "@/lib/brand";
import { abs, seoProduct, type SeoProduct } from "@/lib/seoSource";
import { breadcrumbSchema, productSchema } from "@/lib/schema";
import { JsonLd } from "@/components/seo/JsonLd";
import ProductView from "./ProductView";

/**
 * The product route.
 *
 * A thin server component wrapping the client page, which is unchanged. It
 * exists for one reason: `generateMetadata` needs the id, and only a *page*
 * receives `searchParams` — a layout does not. So every one of the 2,858
 * products shipped the same `<title>Product | 2KONECT</title>` and the same
 * description, which is one search result for a catalogue of thousands.
 *
 * The fetch here is cached by Next for five minutes, so a crawler walking the
 * catalogue costs one origin request per product per window rather than one
 * per hit — which matters against an API answering in about three seconds.
 *
 * None of the client-side work changes: the cache, the preview seeding, the
 * variant selection and the back-navigation behaviour all still live in
 * ProductView and still run exactly as before.
 */

type Params = { searchParams: Promise<{ id?: string }> };

async function load(searchParams: Params["searchParams"]): Promise<SeoProduct | null> {
  const { id } = await searchParams;
  const productId = Number(id);
  if (!productId || Number.isNaN(productId)) return null;
  return seoProduct(productId);
}

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const product = await load(searchParams);

  if (!product) {
    return {
      title: { absolute: `Product | ${BRAND.name}` },
      description: "Price, seller, availability and the delivery window — everything a 2KONECT listing tells you before you buy.",
      // A missing id is not a page worth indexing, but it is still followed so
      // a crawler that lands here can leave through the navigation.
      robots: { index: false, follow: true },
    };
  }

  const canonical = `/product?id=${product.id}`;
  const title = `${product.name} — ${describePrice(product)} | ${BRAND.name}`;

  return {
    title: { absolute: title },
    description: describe(product),
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description: describe(product),
      url: canonical,
      siteName: BRAND.name,
      locale: "en_TZ",
      images: product.image
        ? [{ url: product.image, alt: `${product.name} — sold on ${BRAND.name}` }]
        : [{ url: BRAND.logo.og, width: 1200, height: 630, alt: BRAND.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: describe(product),
      images: product.image ? [product.image] : [BRAND.logo.og],
    },
  };
}

/**
 * The price, said the way the page says it.
 *
 * A product whose combinations differ in price has no single price, so the
 * title says "from" rather than quoting the cheapest as though it were the
 * price — the same rule the page itself follows.
 */
function describePrice(product: SeoProduct): string {
  const money = (value: number) =>
    `${product.price.currency} ${Math.round(value).toLocaleString("en-US")}`;

  if (product.variant_summary?.is_range) return `from ${money(product.variant_summary.price_from)}`;
  return money(product.variant_summary?.price_from ?? product.price.current);
}

/**
 * A description built from what the listing actually says.
 *
 * The seller's own words first, trimmed to a length a search result will
 * show. Nothing is invented and nothing is padded with keywords: where the
 * seller wrote nothing, the fallback states the facts the catalogue holds —
 * what it is, where it ships from, and who sells it.
 */
function describe(product: SeoProduct): string {
  const own = (product.short_description || product.description || "").replace(/\s+/g, " ").trim();

  if (own.length > 60) {
    return own.length > 155 ? `${own.slice(0, 152).trimEnd()}…` : own;
  }

  const parts: string[] = [`${product.name}`];

  if (product.category) parts.push(`in ${product.category.name.trim()}`);
  // "from TZS 1,850,000" already reads as a phrase, so it does not take the
  // preposition a single price does — "at from TZS ..." is not English.
  const price = describePrice(product);
  parts.push(price.startsWith("from ") ? price : `at ${price}`);

  const local = product.sourcing?.is_local;
  if (local === true) parts.push("available in Tanzania");
  else if (local === false) {
    const origin = product.sourcing?.origin?.name;
    parts.push(origin ? `imported from ${origin}` : "imported to order");
  }

  if (product.vendor) parts.push(`from ${product.vendor.name}`);

  return `${parts.join(", ")}. Buy on ${BRAND.name}.`;
}

export default async function ProductPage({ searchParams }: Params) {
  const product = await load(searchParams);

  return (
    <>
      {/* Structured data is emitted server-side so it is in the HTML Google
          first receives, rather than appearing after hydration. The client
          page below renders the interface exactly as it did before. */}
      {product ? (
        <>
          <JsonLd data={productSchema(product)} />
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", path: "/" },
              ...(product.category
                ? [{ name: product.category.name.trim(), path: `/category?id=${product.category.id}` }]
                : []),
              ...(product.subcategory && product.category
                ? [{
                    name: product.subcategory.name.trim(),
                    path: `/category?id=${product.category.id}&subcategory=${product.subcategory.id}`,
                  }]
                : []),
              { name: product.name, path: `/product?id=${product.id}` },
            ])}
          />
          {/* A crawlable summary of the page's own facts, for the moment
              before the client component has fetched anything. It duplicates
              what the interface renders rather than adding claims, and is
              hidden from sight because the interface is what a person reads. */}
          <div className="sr-only">
            <h1>{product.name}</h1>
            <p>{describe(product)}</p>
            <p>
              {describePrice(product)}
              {product.variant_summary
                ? ` · ${product.variant_summary.stock} in stock across ${product.variants.length} options`
                : product.in_stock
                  ? ` · ${product.stock} in stock`
                  : " · Out of stock"}
            </p>
            <a href={abs(`/product?id=${product.id}`)}>{product.name}</a>
          </div>
        </>
      ) : null}

      <ProductView />
    </>
  );
}
