/**
 * Brand identity, in one place.
 *
 * The storefront renders its name from here — header wordmark, footer, page
 * titles, emails and empty states all read these values, so the whole site
 * changes name by editing this file and nothing else.
 */
export const BRAND = {
  /** Full display name. */
  name: "2KONECT",
  /**
   * Short form used where space is tight (a tab title, a dense badge).
   *
   * Never a substitute for the name in prose: the brand is 2KONECT, and
   * "KONECT" on its own is a different word.
   */
  short: "2K",
  tagline: "Connect to what you need.",
  /** One line explaining what the marketplace actually does. */
  promise:
    "Buy what's already in Tanzania, or order it from abroad — and track it all the way to your door.",
  country: "Tanzania",
  city: "Dar es Salaam",
  currency: "TZS",
  supportEmail: "support@2konect.com",
  supportPhone: "+255 764 224 477",
  /** The official first-party seller, shown as the platform's own storefront. */
  officialSeller: "2KONECT Official",
  /**
   * The 2KONECT purple, and the deep ground it sits on.
   *
   * app/globals.css holds the same values as design tokens and is what every
   * component reads. This copy exists only for the two consumers that are
   * handed a plain string and cannot resolve a CSS variable: the PWA manifest
   * and the browser theme colour. Change both together.
   */
  color: {
    primary: "#881bcc",
    deep: "#3b0a5f",
  },
  logo: {
    /** White mark, for purple and dark surfaces. */
    white: "/brand/mark-white.png",
    /** Brand-purple mark, for white and light surfaces. */
    purple: "/brand/mark-purple.png",
    /** Near-black mark, for pale tinted surfaces. */
    ink: "/brand/mark-ink.png",
    /** Rounded app icon: white mark on purple. */
    icon: "/brand/icon-512.png",
    /** Social share card. */
    og: "/brand/og.png",
  },
} as const;

export type Brand = typeof BRAND;
