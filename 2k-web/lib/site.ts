/**
 * Where this site lives.
 *
 * Read by metadata, the sitemap, robots.txt and every structured-data block.
 * Set NEXT_PUBLIC_SITE_URL in the environment for a deployment; the fallback
 * keeps local builds producing valid absolute URLs rather than throwing.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://2konect.com"
).replace(/\/$/, "");

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
