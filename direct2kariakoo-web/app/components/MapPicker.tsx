"use client";
import { useEffect, useRef } from "react";

export default function MapPicker({
  onSelect,
  initialAddress,
}: {
  onSelect: (address: string, lat: number, lng: number) => void;
  initialAddress?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.google || !mapRef.current) return;

    const defaultPosition = { lat: -6.8, lng: 39.28 }; // Dar es Salaam
    const map = new google.maps.Map(mapRef.current, {
      center: defaultPosition,
      zoom: 12,
    });

    const input = document.getElementById("placeInput") as HTMLInputElement;
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo("bounds", map);

    const marker = new google.maps.Marker({ map });
    const geocoder = new google.maps.Geocoder(); // ✅ Added

    // Handle place search
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) return;

      map.setCenter(place.geometry.location);
      marker.setPosition(place.geometry.location);

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      onSelect(place.formatted_address || "Unknown location", lat, lng);
    });

    // Handle map tap
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition(e.latLng);

      // ✅ Convert lat/lng to readable name
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const address = results[0].formatted_address;
          onSelect(address, lat, lng);
        } else {
          onSelect("Unknown location", lat, lng);
        }
      });
    });
  }, []);

  return (
    <div>
      <input
        id="placeInput"
        className="w-full border p-2 rounded mb-2"
        placeholder={initialAddress || "Search or tap on map"}
      />
      <div ref={mapRef} className="w-full h-64 rounded-lg border" />
    </div>
  );
}
