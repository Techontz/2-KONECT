"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * The customer's delivery location — one shared model.
 *
 * The header and checkout both read and write this, so choosing a place in
 * one is immediately reflected in the other. There is deliberately no second
 * location state anywhere in the app.
 */
export interface DeliveryLocation {
  /** Short form for the header, e.g. "Mikocheni". */
  label: string;
  /** Full readable line, used as the order's delivery address. */
  formatted: string;
  latitude: number;
  longitude: number;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
}

const STORAGE_KEY = "2konect.location";
/** The pre-rename key, read once so a saved location survives the rebrand. */
const LEGACY_STORAGE_KEY = "d2k.location";

/** Dar es Salaam city centre — where the map opens when nothing better is known. */
export const DEFAULT_CENTER = { lat: -6.8161, lng: 39.2803 };
export const DEFAULT_CITY = "Dar es Salaam";

interface LocationState {
  location: DeliveryLocation | null;
  ready: boolean;
  setLocation: (location: DeliveryLocation) => void;
  clear: () => void;
}

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<DeliveryLocation | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DeliveryLocation;
        // Guard against a half-written or outdated shape rather than letting
        // a malformed entry break every page that reads the header.
        if (parsed && typeof parsed.formatted === "string" && typeof parsed.latitude === "number") {
          setLocationState(parsed);
        }
      }
    } catch {
      /* unreadable storage simply means no saved location */
    }
    setReady(true);
  }, []);

  const setLocation = useCallback((next: DeliveryLocation) => {
    setLocationState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* not remembered, but the current session still works */
    }
  }, []);

  const clear = useCallback(() => {
    setLocationState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to do */
    }
  }, []);

  const value = useMemo(
    () => ({ location, ready, setLocation, clear }),
    [location, ready, setLocation, clear],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationState {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used inside <LocationProvider>");
  }
  return context;
}

/**
 * Trim administrative wording off an area name for the header.
 *
 * Google returns "Wilaya ya Kinondoni" / "Kinondoni District"; the header has
 * room for the place, not for the word "district" in either language.
 */
function shortAreaName(name: string): string {
  return name
    .replace(/^(Wilaya ya|Mkoa wa|Jiji la|Halmashauri ya)\s+/i, "")
    .replace(/\s+(District|Region|City|Municipal(ity)?|Council)$/i, "")
    .trim();
}

/** A result whose address is only a plus code is useless to a courier. */
function isPlusCodeOnly(result: google.maps.GeocoderResult): boolean {
  const hasRoute = result.address_components?.some((item) => item.types.includes("route"));
  return !hasRoute && /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/.test(result.formatted_address ?? "");
}

/**
 * Turn Google's reverse-geocode results into our own shape.
 *
 * Takes the whole array rather than `results[0]` on purpose. Around Dar es
 * Salaam the first result is frequently a plus code such as "66QR+5PP" while a
 * later one carries the actual street — a rider can find "10 Warioba Street"
 * and cannot find a plus code. Components are gathered across every result for
 * the same reason: the named district often appears only in one of them.
 *
 * The short label prefers the most specific named area, so the header reads
 * "Deliver to Kinondoni" rather than repeating the city.
 */
export function fromGeocoderResults(
  results: google.maps.GeocoderResult[],
  position: { lat: number; lng: number },
): DeliveryLocation {
  const best = results.find((result) => !isPlusCodeOnly(result)) ?? results[0];

  const pick = (...types: string[]): string | null => {
    for (const type of types) {
      // Prefer the chosen result, then fall back to any other result that
      // happens to name this component.
      for (const result of [best, ...results]) {
        const component = result?.address_components?.find((item) => item.types.includes(type));
        if (component?.long_name) return component.long_name;
      }
    }
    return null;
  };

  const street = pick("route");
  const district = pick(
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3",
    "administrative_area_level_2",
  );
  const city = pick("locality", "postal_town");
  const region = pick("administrative_area_level_1");

  const label = shortAreaName(district || city || region || DEFAULT_CITY);

  return {
    label,
    formatted: best?.formatted_address ?? label,
    latitude: position.lat,
    longitude: position.lng,
    street,
    district,
    city,
    region,
  };
}
