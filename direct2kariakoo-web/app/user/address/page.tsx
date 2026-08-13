"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function AddressPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);

  const [selectedAddress, setSelectedAddress] = useState("");
  const [lat, setLat] = useState<number | null>(-6.8);
  const [lng, setLng] = useState<number | null>(39.28);
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  /* ------------------------------------------------------------ */
  /* Load current user address                                    */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${apiBaseUrl}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let addressData = res.data.address;

        if (addressData) {
          // Handle JSON string or object
          if (typeof addressData === "string") {
            addressData = JSON.parse(addressData);
          }

          setSelectedAddress(addressData.address ?? "");
          setLat(Number(addressData.lat));
          setLng(Number(addressData.lng));
        }
      } catch (err) {
        console.log("Address load failed:", err);
      }
    };

    load();
  }, [apiBaseUrl]);

  /* ------------------------------------------------------------ */
  /* Initialize Map (ONLY WHEN lat & lng ARE VALID NUMBERS)       */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    if (!window.google) return;
    if (!mapRef.current) return;
    if (lat === null || lng === null) return;
    if (isNaN(lat) || isNaN(lng)) return;

    const position = { lat, lng };

    // Create map once
    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom: 14,
      });
    }

    // Create marker once
    if (!markerInstance.current) {
      markerInstance.current = new google.maps.Marker({
        position,
        map: mapInstance.current,
        draggable: true,
      });
    } else {
      markerInstance.current.setPosition(position);
      mapInstance.current.setCenter(position);
    }

    /* Reverse Geocoding */
    const geocoder = new google.maps.Geocoder();

    const updateAddress = (lat: number, lng: number) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          setSelectedAddress(results[0].formatted_address ?? "");
        }
      });
    };

    /* Marker drag event */
    markerInstance.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setLat(newLat);
      setLng(newLng);
      updateAddress(newLat, newLng);
    });

    /* Map click event */
    mapInstance.current.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      markerInstance.current.setPosition(e.latLng);
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setLat(newLat);
      setLng(newLng);
      updateAddress(newLat, newLng);
    });
  }, [lat, lng]);

  /* ------------------------------------------------------------ */
  /* Save Address                                                 */
  /* ------------------------------------------------------------ */
  const saveAddress = async () => {
    if (!selectedAddress || lat === null || lng === null) {
      alert("Please select a valid location.");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      await axios.post(
        `${apiBaseUrl}/user/save-address`,
        {
          address: selectedAddress,
          lat,
          lng,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Address saved!");
      router.push("/user/checkout");
    } catch (err) {
      console.error(err);
      alert("Failed to save address");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------ */
  /* UI                                                           */
  /* ------------------------------------------------------------ */
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">
        Select Your Delivery Location
      </h1>

      {/* Address Input Card */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <input
          type="text"
          value={selectedAddress ?? ""}
          onChange={(e) => setSelectedAddress(e.target.value)}
          className="w-full p-3 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-400 outline-none transition"
          placeholder="Search or choose on the map"
        />
      </div>

      {/* Map Card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div ref={mapRef} className="w-full h-80" />
      </div>

      {/* Save Button */}
      <button
        onClick={saveAddress}
        disabled={loading}
        className="w-full bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 text-black py-3 rounded-xl font-semibold transition disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Address"}
      </button>
    </div>
  );
}
