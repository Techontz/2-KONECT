/**
 * Brand identity, in one place.
 *
 * The storefront renders its name from here — header wordmark, footer, page
 * titles, emails and empty states all read these values, so the whole site
 * changes name by editing this file and nothing else.
 */
export const BRAND = {
  /** Full legal / display name. */
  name: "Direct2Kariakoo",
  /** Short form used where space is tight (mobile header, tab title). */
  short: "D2K",
  /** Wordmark split so the header can render the two halves differently. */
  wordmark: { lead: "direct", tail: "2kariakoo" },
  tagline: "Tanzania's marketplace — delivered direct.",
  country: "Tanzania",
  city: "Dar es Salaam",
  currency: "TZS",
  supportEmail: "support@direct2kariakoo.com",
  supportPhone: "+255 764 224 477",
} as const;

export type Brand = typeof BRAND;
