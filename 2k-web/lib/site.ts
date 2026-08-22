/**
 * Where this site lives.
 *
 * Read by metadata, the sitemap, robots.txt and every structured-data block —
 * so this one string decides which domain Google is told owns every page.
 *
 * It said `2konect.com`, which is not this marketplace: that domain is parked
 * and serves a redirect to a lander. The live site is www.2konect.shop, and
 * every page it served carried `<link rel="canonical" href="https://2konect.com/">`
 * — an instruction to Google that the real version of each URL lives on a
 * domain with no matching content. That is the kind of mistake that keeps a
 * site out of the index entirely, whatever else is done to it.
 *
 * `www` rather than the apex because that is what actually answers: the apex
 * returns a 308 to www, and a canonical should point at the URL that returns
 * 200 rather than at a redirect.
 *
 * Set NEXT_PUBLIC_SITE_URL in the environment to override; the fallback is the
 * production host so a build with the variable missing still emits correct
 * canonicals rather than silently poisoning them.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.2konect.shop"
).replace(/\/$/, "");

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
