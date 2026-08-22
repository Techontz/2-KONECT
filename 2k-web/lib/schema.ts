import { BRAND } from "./brand";
import { SITE_URL } from "./site";
import type { SeoProduct } from "./seoSource";

/**
 * Schema.org blocks, built only from what the API actually returned.
 *
 * The rule throughout: nothing is invented. A product with no reviews gets no
 * `aggregateRating`, a seller we cannot name gets no `brand`, and a price the
 * catalogue does not hold is not guessed at. Structured data that overstates
 * what a site knows is worse than none — it is the sort of thing that earns a
 * manual action rather than a rich result.
 */

const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Strip undefined so the emitted JSON has no empty keys. */
function clean<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null)) as T;
}

/**
 * Who runs this marketplace.
 *
 * Every field is read from lib/brand.ts — the name, the promise, the support
 * contact, the country and the currency the project already states about
 * itself. Nothing is composed for search.
 *
 * There is deliberately no `sameAs`. That property is where a business lists
 * its real social profiles, and this project holds none: the only social
 * string anywhere in the codebase is the placeholder in the seller
 * application form. Listing invented accounts would be a claim about a
 * business rather than a technical detail, and a `sameAs` pointing at profiles
 * that are not ours is worse for brand recognition than none. Add the real
 * URLs to BRAND and they will appear here.
 */
export function organizationSchema() {
  return clean({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": abs("/#organization"),
    name: BRAND.name,
    url: SITE_URL,
    logo: abs(BRAND.logo.icon),
    image: abs(BRAND.logo.og),
    description: BRAND.promise,
    slogan: BRAND.tagline,
    // The market this serves. Stated because it is the single most useful
    // thing Google can know about a marketplace whose name gives no clue as
    // to where it operates.
    areaServed: { "@type": "Country", name: BRAND.country },
    currenciesAccepted: BRAND.currency,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: BRAND.supportEmail,
      telephone: BRAND.supportPhone,
      areaServed: "TZ",
      availableLanguage: ["en", "sw"],
    },
  });
}

/**
 * The site itself, and how its search works.
 *
 * The SearchAction target is the real search URL — `/search?q=` — verified
 * against the route that exists. A SearchAction pointing at a URL that does
 * not resolve is a broken promise to a crawler.
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": abs("/#website"),
    url: SITE_URL,
    name: BRAND.name,
    description: BRAND.promise,
    publisher: { "@id": abs("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: abs(step.path),
    })),
  };
}

/**
 * A product, priced the way it is actually sold.
 *
 * The important part is the offer. A product that sells by combination does
 * not have *a* price — an iPhone here runs from 1,850,000 to 2,200,000
 * depending on colour and storage — so it emits an `AggregateOffer` carrying
 * the real low and high, plus one `Offer` per combination with that
 * combination's own price, availability and SKU. Emitting a single Offer at
 * the parent price would tell Google that every variant costs the cheapest
 * one, which is a price claim the checkout would refuse to honour.
 *
 * An ordinary product emits one plain Offer, exactly as before.
 */
export function productSchema(product: SeoProduct) {
  const currency = product.price.currency;
  const url = abs(`/product?id=${product.id}`);
  const availability = (inStock: boolean) =>
    inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const summary = product.variant_summary;
  const variants = product.variants ?? [];

  const offers =
    summary && variants.length
      ? clean({
          "@type": "AggregateOffer",
          priceCurrency: currency,
          lowPrice: summary.price_from,
          highPrice: summary.price_to,
          offerCount: variants.length,
          availability: availability(summary.in_stock),
          offers: variants.map((variant) =>
            clean({
              "@type": "Offer",
              url,
              priceCurrency: currency,
              price: variant.price.current,
              availability: availability(variant.in_stock),
              sku: variant.sku ?? undefined,
              seller: product.vendor
                ? { "@type": "Organization", name: product.vendor.name }
                : undefined,
            }),
          ),
        })
      : clean({
          "@type": "Offer",
          url,
          priceCurrency: currency,
          price: product.price.current,
          availability: availability(product.in_stock),
          seller: product.vendor
            ? { "@type": "Organization", name: product.vendor.name }
            : undefined,
        });

  return clean({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    description:
      (product.short_description || product.description || "").replace(/\s+/g, " ").trim() || undefined,
    image: product.images?.length ? product.images : product.image ? [product.image] : undefined,
    sku: String(product.id),
    category: product.subcategory?.name ?? product.category?.name ?? undefined,
    // The seller is the brand we can actually name. There is no manufacturer
    // field in the catalogue, so none is claimed.
    brand: product.vendor ? { "@type": "Brand", name: product.vendor.name } : undefined,
    // Emitted only when reviews genuinely exist.
    aggregateRating:
      product.rating?.count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
          }
        : undefined,
    offers,
  });
}

/**
 * A category as a list of the products it actually contains.
 *
 * Positions follow the order the page renders, and each entry is a real URL a
 * crawler can follow.
 */
export function itemListSchema(name: string, items: { id: number; name: string }[]) {
  if (!items.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: abs(`/product?id=${item.id}`),
    })),
  };
}
