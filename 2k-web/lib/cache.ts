"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Server-state cache with stale-while-revalidate.
 *
 * Every storefront page is a client component that fetched in `useEffect`, so
 * returning to a page the shopper had already seen threw the data away and
 * asked for it again — a full skeleton and, against the production API, a
 * three-second wait for bytes the browser had held moments earlier.
 *
 * Why this and not SWR or TanStack Query: the storefront already has one
 * network layer (`lib/api.ts` → `lib/shop.ts`) with its own auth interceptor
 * and error shapes, and a second library would either duplicate it or have to
 * be threaded through it. What was missing is small and specific — keep the
 * last answer, hand it back instantly, refresh it quietly — so it lives here
 * in about a hundred lines and no new bytes ship to the browser.
 *
 * The contract:
 *
 *   fresh  (age < ttl)      → cached value, no request at all
 *   stale  (ttl < age)      → cached value *immediately*, refreshed in the
 *                             background, UI updated only if it changed
 *   missing                 → the one and only case that shows a skeleton
 *
 * Two components asking for the same key at the same moment share one request.
 *
 * WHAT MUST NEVER GO THROUGH HERE: the cart, checkout, payment, orders,
 * addresses and the signed-in profile. Those are live state where a stale
 * answer is a wrong answer, and they deliberately keep calling `shop.*`
 * directly. See `lib/queries.ts` for the read-only catalogue surface that does
 * use it.
 */

type Entry = { data: unknown; at: number };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

/** Values worth surviving a hard reload, kept per tab rather than forever. */
const STORE_PREFIX = "2konect.q.";

function readSession(key: string): Entry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    return typeof parsed?.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, entry: Entry) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota or private browsing. The in-memory copy still does its job.
  }
}

/**
 * The in-memory copy only.
 *
 * Safe to call while rendering, which is why it does not touch
 * sessionStorage: the server has none, so a component that consulted it during
 * the hydrating render would produce different markup from the server's and
 * React would throw away the whole tree (error #418). Persisted values are
 * promoted into memory from an effect instead — see `hydrate` below — so they
 * appear one frame after hydration rather than during it.
 */
function read(key: string): Entry | null {
  return memory.get(key) ?? null;
}

/**
 * Promote a persisted value into memory. Never called during a render.
 */
function hydrate(key: string, persist: boolean): Entry | null {
  const hit = memory.get(key);
  if (hit) return hit;
  if (!persist) return null;

  const stored = readSession(key);
  if (stored) memory.set(key, stored);
  return stored;
}

function write(key: string, data: unknown, persist: boolean) {
  const entry: Entry = { data, at: Date.now() };
  memory.set(key, entry);
  if (persist) writeSession(key, entry);
  listeners.get(key)?.forEach((notify) => notify());
}

/**
 * Fetch through the cache, collapsing concurrent callers onto one request.
 *
 * Exported so a link can warm a destination on hover without rendering it.
 */
export function fetchQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttl = 60_000, persist = false }: { ttl?: number; persist?: boolean } = {},
): Promise<T> {
  const hit = hydrate(key, persist);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const request = fetcher()
    .then((data) => {
      write(key, data, persist);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/** Warm a key without subscribing to it. Failures are deliberately silent. */
export function prefetchQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; persist?: boolean },
) {
  fetchQuery(key, fetcher, options).catch(() => undefined);
}

/** Replace a key's value and tell every subscriber. Used to append a page. */
export function writeQuery(key: string, data: unknown, persist = false) {
  write(key, data, persist);
}

/** Read a key without subscribing, fetching or extending its life. */
export function peekQuery<T>(key: string, persist = false): T | null {
  const hit = hydrate(key, persist);
  return hit ? (hit.data as T) : null;
}

/** Seed the cache from data already on the screen, so opening it costs nothing. */
export function seedQuery(key: string, data: unknown, persist = false) {
  if (memory.has(key)) return;
  write(key, data, persist);
}

/** Drop every key beginning with `prefix` — used after a write invalidates reads. */
export function invalidateQueries(prefix: string) {
  for (const key of Array.from(memory.keys())) {
    if (!key.startsWith(prefix)) continue;
    memory.delete(key);
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(STORE_PREFIX + key); } catch { /* ignore */ }
    }
    listeners.get(key)?.forEach((notify) => notify());
  }
}

export interface QueryState<T> {
  data: T | null;
  /** True only when there is nothing to show yet — i.e. the first ever visit. */
  loading: boolean;
  /** True while a cached value on screen is being quietly refreshed. */
  revalidating: boolean;
  /** Set only when the request failed *and* no cached value could be shown. */
  error: boolean;
  refresh: () => void;
}

/**
 * Subscribe a component to a cached key.
 *
 * `key` doubles as the dependency: change it and the hook re-reads, which is
 * why callers build it from the query they are about to make.
 *
 * Pass `key: null` to stand down entirely (a route that has no id yet, a
 * seller being redirected away from the shop).
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  { ttl = 60_000, persist = false, enabled = true }: {
    ttl?: number;
    persist?: boolean;
    enabled?: boolean;
  } = {},
): QueryState<T> {
  const active = Boolean(key) && enabled;

  // Held in a ref so a fetcher rebuilt on every render does not restart the
  // effect; `key` is the only thing that decides when to go back to the
  // network.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Memory only: see `read`. On a cold page load this is empty during the
  // hydrating render, exactly as it was on the server, and the persisted copy
  // arrives from the effect below immediately afterwards.
  const cached = active ? read(key as string) : null;

  const [, force] = useState(0);
  const [error, setError] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

  const run = useCallback(
    (background: boolean) => {
      if (!key) return;
      if (background) setRevalidating(true);

      const previous = memory.get(key);

      fetchQuery(key, fetcherRef.current, { ttl: 0, persist })
        .then((data) => {
          setError(false);
          // `write` inside fetchQuery already notified subscribers, but only
          // when the value is genuinely new does anything need to repaint.
          if (previous && Object.is(previous.data, data)) force((n) => n + 1);
        })
        .catch(() => {
          // A failed refresh must not blank a page that is already readable:
          // the cached copy stays, and only a cold miss surfaces as an error.
          if (!memory.has(key)) setError(true);
        })
        .finally(() => setRevalidating(false));
    },
    [key, persist],
  );

  useEffect(() => {
    if (!active || !key) return;

    const notify = () => force((n) => n + 1);
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(notify);

    // Pull the persisted copy in now that rendering is over. If it was not
    // already in memory this makes the component repaint with it.
    const hadInMemory = memory.has(key);
    const entry = hydrate(key, persist);
    if (entry && !hadInMemory) notify();

    if (!entry) run(false);
    else if (Date.now() - entry.at >= ttl) run(true);

    return () => {
      set?.delete(notify);
      if (set && set.size === 0) listeners.delete(key);
    };
    // `run` is keyed on `key`; ttl/persist are configuration, not inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);

  return {
    data: (cached?.data as T) ?? null,
    loading: active && !cached && !error,
    revalidating,
    error: error && !cached,
    refresh: () => {
      if (key) memory.delete(key);
      run(true);
    },
  };
}
