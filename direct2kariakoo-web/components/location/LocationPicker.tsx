"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_CENTER,
  fromGeocoderResults,
  useLocation,
  type DeliveryLocation,
} from "@/lib/store/location";

/** Tanzania, so search and geocoding answer with places the courier can reach. */
const COUNTRY = "tz";

interface MapsLibraries {
  maps: google.maps.MapsLibrary;
  places: google.maps.PlacesLibrary;
  geocoding: google.maps.GeocodingLibrary;
}

let loaderPromise: Promise<MapsLibraries> | null = null;

/**
 * Load the Maps JavaScript API once per page.
 *
 * Two pickers (header and checkout) share the same promise, so opening one
 * after the other reuses the already-loaded library instead of injecting a
 * second script tag.
 */
function loadMaps(): Promise<MapsLibraries> {
  if (!loaderPromise) {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      v: "weekly",
    });

    loaderPromise = Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("geocoding"),
    ]).then(([maps, places, geocoding]) => ({ maps, places, geocoding }));
  }

  return loaderPromise;
}

/**
 * Delivery location picker.
 *
 * One component, used from both the header and checkout — the requirement was
 * explicitly a single location system, so there is no second map anywhere.
 *
 * The pin is a fixed overlay at the centre of the viewport rather than a
 * draggable marker: panning the map moves the location, which is the gesture
 * shoppers already know from ride-hailing and food-delivery apps and works
 * identically with a mouse and a thumb.
 */
export function LocationPicker({
  open,
  onClose,
  onConfirm,
  title,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the confirmed location. Defaults to saving it as the delivery location. */
  onConfirm?: (location: DeliveryLocation) => void;
  title?: string;
}) {
  const t = useT();
  const { location: saved, setLocation } = useLocation();

  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  // Guards the geocode that runs on every idle: an in-flight lookup for a
  // stale centre must not overwrite a newer one.
  const requestId = useRef(0);

  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [resolved, setResolved] = useState<DeliveryLocation | null>(null);
  const [resolving, setResolving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [term, setTerm] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);

  /** Reverse geocode the current map centre and update the readout. */
  const resolveCentre = useCallback(() => {
    const map = mapRef.current;
    const geocoder = geocoderRef.current;
    if (!map || !geocoder) return;

    const centre = map.getCenter();
    if (!centre) return;

    const position = { lat: centre.lat(), lng: centre.lng() };
    const id = ++requestId.current;
    setResolving(true);

    geocoder.geocode({ location: position }, (results, geocodeStatus) => {
      if (id !== requestId.current) return;
      setResolving(false);

      if (geocodeStatus === "OK" && results && results.length > 0) {
        setResolved(fromGeocoderResults(results, position));
      } else {
        // No street address here — still a valid delivery point, so keep the
        // coordinates and let the customer add directions in the notes.
        setResolved({
          label: saved?.city ?? t("map.country"),
          formatted: `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
          latitude: position.lat,
          longitude: position.lng,
        });
      }
    });
  }, [saved?.city, t]);

  // ---- boot the map when the modal opens ----
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setStatus("loading");
    setNotice(null);

    loadMaps()
      .then(({ maps, places, geocoding }) => {
        if (cancelled || !mapNode.current) return;

        const centre = saved
          ? { lat: saved.latitude, lng: saved.longitude }
          : DEFAULT_CENTER;

        const map = new maps.Map(mapNode.current, {
          center: centre,
          zoom: saved ? 17 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        mapRef.current = map;
        geocoderRef.current = new geocoding.Geocoder();
        autocompleteRef.current = new places.AutocompleteService();
        sessionRef.current = new places.AutocompleteSessionToken();

        // Tapping the map recentres it, which then triggers the same idle
        // handler as panning — one code path for every way of choosing.
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) map.panTo(event.latLng);
        });

        map.addListener("idle", resolveCentre);

        setStatus("ready");
        resolveCentre();
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [open, saved, resolveCentre]);

  // Lock the page behind the modal.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // ---- search ----
  useEffect(() => {
    if (!open || term.trim().length < 3) {
      setPredictions([]);
      return;
    }

    const service = autocompleteRef.current;
    if (!service) return;

    // Debounced: one request per pause in typing rather than per keystroke.
    const timer = window.setTimeout(() => {
      service.getPlacePredictions(
        {
          input: term.trim(),
          componentRestrictions: { country: COUNTRY },
          sessionToken: sessionRef.current ?? undefined,
        },
        (results) => setPredictions(results ?? []),
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [term, open]);

  function choosePrediction(prediction: google.maps.places.AutocompletePrediction) {
    const geocoder = geocoderRef.current;
    const map = mapRef.current;
    if (!geocoder || !map) return;

    setTerm(prediction.description);
    setPredictions([]);

    geocoder.geocode({ placeId: prediction.place_id }, (results, geocodeStatus) => {
      if (geocodeStatus === "OK" && results?.[0]) {
        map.panTo(results[0].geometry.location);
        map.setZoom(17);
      }
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice(t("map.unsupported"));
      return;
    }

    setLocating(true);
    setNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        map.panTo({ lat: position.coords.latitude, lng: position.coords.longitude });
        map.setZoom(17);
      },
      () => {
        // A refusal must never block checkout — the map still works by hand.
        setLocating(false);
        setNotice(t("map.denied"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function confirm() {
    if (!resolved) return;
    if (onConfirm) onConfirm(resolved);
    else setLocation(resolved);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-picker-title"
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
    >
      <div className="flex h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] sm:h-[86vh] sm:rounded-[var(--radius-lg)]">
        {/* ---- header ---- */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--color-line)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.back")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[color:var(--color-surface-alt)]"
          >
            <ArrowIcon className="h-5 w-5" />
          </button>

          <h2 id="location-picker-title" className="min-w-0 flex-1 truncate text-[17px] font-black">
            {title ?? t("map.title")}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[color:var(--color-surface-alt)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* ---- search + current location ---- */}
        <div className="relative shrink-0 border-b border-[color:var(--color-line)] px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-surface-alt)] px-4 ring-1 ring-[color:var(--color-line)]">
              <SearchIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-muted)]" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={t("map.searchPlaceholder")}
                aria-label={t("map.searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating || status !== "ready"}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-4 text-[13px] font-bold text-[color:var(--color-brand)] ring-1 ring-[color:var(--color-line)] hover:bg-[color:var(--color-brand-50)] disabled:opacity-50"
            >
              <TargetIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {locating ? t("map.locating") : t("map.useCurrentLocation")}
              </span>
            </button>
          </div>

          {predictions.length > 0 ? (
            <ul className="absolute left-4 right-4 top-[calc(100%-4px)] z-10 max-h-64 overflow-auto rounded-[var(--radius-sm)] bg-[color:var(--color-surface)] py-1 shadow-[var(--shadow-hover)] ring-1 ring-[color:var(--color-line)]">
              {predictions.map((prediction) => (
                <li key={prediction.place_id}>
                  <button
                    type="button"
                    onClick={() => choosePrediction(prediction)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[color:var(--color-surface-alt)]"
                  >
                    <PinIcon className="mt-[3px] h-4 w-4 shrink-0 text-[color:var(--color-ink-faint)]" />
                    <span className="min-w-0 text-[13px]">
                      <span className="block font-semibold">
                        {prediction.structured_formatting.main_text}
                      </span>
                      <span className="block text-[11px] text-[color:var(--color-ink-muted)]">
                        {prediction.structured_formatting.secondary_text}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ---- map ---- */}
        <div className="relative min-h-0 flex-1 bg-[color:var(--color-surface-alt)]">
          <div ref={mapNode} className="absolute inset-0" />

          {status === "ready" ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="mb-2 rounded-[var(--radius-sm)] bg-[color:var(--color-ink)] px-3 py-1.5 text-[12px] font-bold text-white shadow-[var(--shadow-card)]">
                {t("map.deliveredHere")}
              </span>
              {/* Offset by the pin height so the tip, not the middle of the
                  teardrop, sits on the centre point being geocoded. */}
              <MarkerIcon className="h-9 w-9 -translate-y-[2px] drop-shadow-md" />
            </div>
          ) : null}

          {status === "loading" ? (
            <p className="absolute inset-0 flex items-center justify-center text-[13px] text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </p>
          ) : null}

          {status === "failed" ? (
            <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] text-[color:var(--color-ink-muted)]">
              {t("map.loadFailed")}
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="absolute inset-x-3 top-3 rounded-[var(--radius-sm)] bg-[color:var(--color-warn-soft)] px-3 py-2 text-[12px] font-semibold text-[color:var(--color-warn)]"
            >
              {notice}
            </p>
          ) : null}
        </div>

        {/* ---- readout + confirm ---- */}
        <div className="shrink-0 border-t border-[color:var(--color-line)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-alt)]">
              <PinIcon className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                {t("map.currentLocation")}
              </p>
              <p className="clamp-2 text-[14px] font-bold leading-snug">
                {resolving && !resolved
                  ? t("map.selecting")
                  : resolved?.formatted || t("map.dragHint")}
              </p>
              {resolved?.label ? (
                <p className="clamp-1 text-[12px] text-[color:var(--color-ink-muted)]">
                  {[resolved.label, resolved.region, t("map.country")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={!resolved || status !== "ready"}
              className="h-12 w-full shrink-0 rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-6 text-[14px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-[color:var(--color-brand-strong)] disabled:bg-[color:var(--color-line-strong)] sm:w-auto"
            >
              {t("map.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- icons ---------------- */

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function TargetIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function MarkerIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 23s8-6.4 8-12.6A8 8 0 004 10.4C4 16.6 12 23 12 23z"
        fill="var(--color-ink)"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10.2" r="3" fill="#fff" />
    </svg>
  );
}
