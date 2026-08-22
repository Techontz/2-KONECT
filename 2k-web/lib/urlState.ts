/**
 * Filter state in the address bar.
 *
 * Written with the browser's own `replaceState` rather than through the Next
 * router. A `router.replace` is a navigation: it re-runs the route's server
 * component and refetches its payload, which for a control the shopper drags
 * would mean a server round-trip per frame and would undo the work that made
 * these pages repaint instantly. `replaceState` only rewrites the URL, which
 * is all a filter needs — the grid is already re-rendering from client state.
 *
 * `replace` rather than `push` on purpose. Every chip and every drag would
 * otherwise become a history entry, and Back would crawl through a shopper's
 * filtering instead of returning them to the page they came from.
 */
export function writeSearchParams(updates: Record<string, string | number | boolean | undefined>) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "" || value === false) url.searchParams.delete(key);
    else url.searchParams.set(key, value === true ? "1" : String(value));
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  window.history.replaceState(window.history.state, "", next);
}

/** The current query string, read straight from the document. */
export function currentSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function boolParam(params: URLSearchParams, key: string): boolean | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  return raw === "1" || raw === "true";
}
