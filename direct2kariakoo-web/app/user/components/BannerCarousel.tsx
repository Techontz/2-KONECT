"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";

/* -------------------------------------------------------------------------- */
/* Interfaces                                                                 */
/* -------------------------------------------------------------------------- */
interface Banner {
  id: number;
  image: string;
  alt?: string;
  link?: string;
}

/* -------------------------------------------------------------------------- */
/* Cache Constants                                                            */
/* -------------------------------------------------------------------------- */
const BANNER_CACHE_KEY = "d2k_cached_banners";
const BANNER_CACHE_TIME = "d2k_banner_cache_time";
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(BANNER_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
    }
    return [];
  });

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isClient, setIsClient] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* 🧠 Mark client ready (prevent SSR hydration error)                         */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    setIsClient(true);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 🧠 Fetch banners with cache                                                */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const now = Date.now();
    const cachedTime = localStorage.getItem(BANNER_CACHE_TIME);

    if (cachedTime && now - parseInt(cachedTime) < CACHE_TTL) return;

    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/banners`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        if (data.length > 0) {
          setBanners(data);
          localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(BANNER_CACHE_TIME, now.toString());
        }
      })
      .catch((err) => console.error("⚠️ Failed to refresh banners:", err));
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 🎞️ Auto-slide logic                                                      */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (isPaused || banners.length === 0) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, banners]);

  if (!isClient || banners.length === 0) return null;

  /* -------------------------------------------------------------------------- */
  /* 🎨 Layout (no rounded corners, full width)                                 */
  /* -------------------------------------------------------------------------- */
  return (
    <div
      className="
        relative 
        w-screen             /* full-edge width */
        sm:w-full  
        h-[180px] sm:h-[250px] md:h-[320px]  /* responsive heights */
        overflow-hidden select-none
        mx-auto               /* center alignment for larger screens */
      "
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 🖼️ Banners */}
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <a href={banner.link || "#"} target="_blank" rel="noopener noreferrer">
            <Image
              src={
                banner.image.startsWith("http")
                  ? banner.image
                  : `${process.env.NEXT_PUBLIC_STORAGE_URL}/${banner.image}`
              }
              alt={banner.alt || "Banner"}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </a>
        </div>
      ))}

      {/* 🧭 Arrows (desktop only) */}
      <div className="hidden md:flex absolute inset-0 justify-between items-center px-4 z-20">
        <button
          onClick={() =>
            setCurrent((prev) => (prev === 0 ? banners.length - 1 : prev - 1))
          }
          className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-md transition-all active:scale-90"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() =>
            setCurrent((prev) =>
              prev === banners.length - 1 ? 0 : prev + 1
            )
          }
          className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-md transition-all active:scale-90"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 🟡 Dots */}
      <div className="absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-2">
        {banners.map((_, i) => (
          <div
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-[3px] rounded-full cursor-pointer transition-all duration-300 ${
              i === current ? "bg-yellow-400 w-6" : "bg-gray-300 w-4 hover:bg-gray-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
