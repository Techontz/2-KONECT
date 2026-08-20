import axios from "axios";

/**
 * Shared axios instance for the Laravel API.
 *
 * The storefront is browsable signed-out, so a 401 is a normal outcome here
 * (checking the wishlist, resuming a cart) rather than an error worth bouncing
 * the visitor to a login page for. The interceptor therefore clears stale
 * credentials and lets the caller decide what to do — the previous behaviour
 * of hard-redirecting on every 401 made public browsing impossible.
 */

/**
 * Resolve the API origin against the host the page was actually opened from.
 *
 * `NEXT_PUBLIC_API_URL` is baked in at build time, so a loopback value is only
 * correct when the browser runs on the same machine as the backend. Opening the
 * site from a phone on the same Wi-Fi makes `127.0.0.1` mean *the phone*, and
 * every request fails before it leaves the device — which is exactly what the
 * "couldn't load the storefront" state was reporting.
 *
 * Substituting the browsing hostname keeps one configuration working from the
 * laptop, from a handset, and after the router hands out a different lease.
 */
function resolveBaseURL(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  if (typeof window === "undefined") return configured;

  try {
    const url = new URL(configured, window.location.origin);
    const loopback =
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "::1";

    // Only rewrite a loopback target, and only when the page itself is being
    // served from somewhere else. A deployed absolute URL is left alone.
    if (loopback && window.location.hostname !== url.hostname) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return configured;
  }
}

const baseURL = resolveBaseURL();

export const TOKEN_KEY = "2konect.token";
export const USER_KEY = "2konect.user";

/**
 * The pre-rename keys.
 *
 * Read once at startup and migrated across, so the rebrand does not sign out
 * everybody who was already logged in.
 */
const LEGACY_KEYS: Record<string, string> = {
  "d2k.token": TOKEN_KEY,
  "d2k.user": USER_KEY,
};

function migrateLegacyStorage() {
  if (typeof window === "undefined") return;

  for (const [old, current] of Object.entries(LEGACY_KEYS)) {
    try {
      const value = window.localStorage.getItem(old);
      if (value !== null && window.localStorage.getItem(current) === null) {
        window.localStorage.setItem(current, value);
      }
      window.localStorage.removeItem(old);
    } catch {
      // Private browsing can refuse storage; the session simply is not carried.
    }
  }
}

migrateLegacyStorage();

export const api = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // The credential is stale — drop it so the UI renders as a guest.
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent("2konect:unauthenticated"));
    }
    return Promise.reject(error);
  }
);

/**
 * True when the server refused the request outright.
 *
 * A 403 from a seller endpoint means the account lacks a store record — a
 * missing profile, not a broken session — and callers need to say something
 * different for it than for a network failure.
 */
export function isForbidden(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 403;
}

/** Pull a human-readable message out of a Laravel error response. */
export function apiError(error: unknown, fallback = "Something went wrong."): string {
  const response = (error as { response?: { data?: Record<string, unknown> } })?.response;
  const data = response?.data;

  if (!data) return fallback;
  if (typeof data.message === "string" && data.message) return data.message;

  const errors = data.errors as Record<string, string[]> | undefined;
  if (errors) {
    const first = Object.values(errors)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }

  return fallback;
}

export default api;
