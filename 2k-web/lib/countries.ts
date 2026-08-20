/**
 * The sourcing countries 2KONECT knows about.
 *
 * This is a display table — flag, name, and the city we actually route
 * through — not a list of what is in stock. Which countries appear anywhere in
 * the interface is decided by the catalogue: `/shop/products` returns an
 * `origins` facet with a live count per country, and every surface that offers
 * "shop by country" renders that facet and looks the presentation up here.
 * A country with nothing in it is therefore never shown, and adding a supplier
 * in a new country makes it appear without a deploy.
 *
 * Keyed by ISO 3166-1 alpha-2, which is what `products.source_country` stores
 * and what the API validates.
 */
export interface CountryMeta {
  name: string;
  flag: string;
  /** The port or hub a shipment from here usually leaves from. */
  hub: string;
}

export const COUNTRIES: Record<string, CountryMeta> = {
  TZ: { name: "Tanzania", flag: "🇹🇿", hub: "Dar es Salaam" },
  CN: { name: "China", flag: "🇨🇳", hub: "Guangzhou" },
  AE: { name: "UAE", flag: "🇦🇪", hub: "Dubai" },
  US: { name: "United States", flag: "🇺🇸", hub: "New York" },
  GB: { name: "United Kingdom", flag: "🇬🇧", hub: "London" },
  TR: { name: "Türkiye", flag: "🇹🇷", hub: "Istanbul" },
  IN: { name: "India", flag: "🇮🇳", hub: "Mumbai" },
  JP: { name: "Japan", flag: "🇯🇵", hub: "Tokyo" },
  KE: { name: "Kenya", flag: "🇰🇪", hub: "Nairobi" },
  UG: { name: "Uganda", flag: "🇺🇬", hub: "Kampala" },
  RW: { name: "Rwanda", flag: "🇷🇼", hub: "Kigali" },
  ZA: { name: "South Africa", flag: "🇿🇦", hub: "Johannesburg" },
};

/** Presentation for a country code, falling back to the code itself. */
export function country(code: string | null | undefined): CountryMeta {
  const key = (code ?? "").toUpperCase();
  return COUNTRIES[key] ?? { name: key || "Abroad", flag: "🌍", hub: "" };
}
