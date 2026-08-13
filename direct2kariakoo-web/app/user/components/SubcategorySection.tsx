"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Subcategory {
  id: number;
  name: string;
  icon_image_url?: string | null;
}

interface Props {
  categoryId: number;
  onSelectSubcategory: (id: number) => void;
}

const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12h
const memoryCache = new Map<number, { data: Subcategory[]; time: number }>();
const getSavedSub = (catId: number) =>
  Number(localStorage.getItem(`active_sub_${catId}`)) || null;
const hasSavedSub = (catId: number) =>
  localStorage.getItem(`active_sub_${catId}`) !== null;

export default function SubcategorySection({
  categoryId,
  onSelectSubcategory
}: Props) {
  const hasInitializedSubcategory = useRef(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    // 🔥 RESET subcategory state when category changes
    localStorage.removeItem(`active_sub_${categoryId}`);
    hasInitializedSubcategory.current = false;
    setSelectedId(null);
  }, [categoryId]);
  
  /* ------------------ Load & Cache ------------------ */
  useEffect(() => {
    if (!categoryId) return;
    const cacheKey = `subcategory_cache_${categoryId}`;
    const now = Date.now();

    if (memoryCache.has(categoryId)) {
      const { data, time } = memoryCache.get(categoryId)!;
      if (now - time < CACHE_EXPIRY_MS) {
        setSubcategories(data);
        setLoading(false);
    
        const savedSub = getSavedSub(categoryId);
        if (data.length > 0) {
          const selected =
            data.find(s => s.id === savedSub) || data[0];
    
            setSelectedId(selected.id);

            // ❗ ONLY notify parent if there is NO saved subcategory
            if (!hasSavedSub(categoryId)) {
              onSelectSubcategory(selected.id);
            }
            
        }
        return;
      }
    }
    
    const localCache = localStorage.getItem(cacheKey);
    if (localCache) {
      try {
        const parsed = JSON.parse(localCache);
        if (now - parsed.time < CACHE_EXPIRY_MS && Array.isArray(parsed.data)) {
          setSubcategories(parsed.data);
          setLoading(false);
          memoryCache.set(categoryId, parsed);
          if (parsed.data.length > 0) {
            const savedSub = getSavedSub(categoryId);
            const selected =
          (parsed.data as Subcategory[]).find(
            (s: Subcategory) => s.id === savedSub
          ) || parsed.data[0];

          setSelectedId(selected.id);

          // ❗ ONLY notify parent if there is NO saved subcategory
          if (!hasSavedSub(categoryId)) {
            onSelectSubcategory(selected.id);
          }
          
          }          
          return;
        }
      } catch {}
    }

    setLoading(true);
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories/${categoryId}/subcategories`)
      .then((res) => {
        const subs = Array.isArray(res.data) ? res.data : [];
        const cacheData = { data: subs, time: now };
        memoryCache.set(categoryId, cacheData);
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        setSubcategories(subs);
        const savedSub = getSavedSub(categoryId);
        if (subs.length > 0) {
          const selected =
            subs.find((s) => s.id === savedSub) || subs[0];
        
          setSelectedId(selected.id);
        
          // 🔒 auto-select ONLY ONCE per category
          if (!hasInitializedSubcategory.current) {
            hasInitializedSubcategory.current = true;
            onSelectSubcategory(selected.id);
          }
        }        
      })
      .catch((err) => console.error("❌ Error loading subcategories:", err))
      .finally(() => setLoading(false));
  }, [categoryId]);

  /* ------------------ Scroll Logic ------------------ */
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
    const progress = (el.scrollLeft / (el.scrollWidth - el.clientWidth)) * 100;
    setScrollProgress(progress);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -400 : 400, behavior: "smooth" });
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  /* ------------------ Loading Skeleton ------------------ */
  if (loading)
    return (
      <div className="grid grid-cols-4 sm:flex sm:overflow-hidden px-6 py-6 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
            <div className="w-[65px] h-[65px] rounded-full bg-gray-200" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );

  if (subcategories.length === 0)
    return (
      <div className="flex justify-center py-6 text-gray-400 text-sm">
        No subcategories found.
      </div>
    );

  /* ------------------ UI ------------------ */
  return (
    <div className="relative bg-white pt-4 pb-10 px-4">
      {/* ◀ Arrow for desktop */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-200 rounded-full shadow-md w-8 h-8 hidden sm:flex items-center justify-center hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {/* 🔹 Scrollable on desktop, 2-row grid on mobile */}
      <div
        ref={scrollRef}
        className="grid grid-cols-4 gap-6 sm:flex sm:gap-8 sm:overflow-x-auto sm:scroll-smooth sm:scrollbar-hide items-center"
      >
        {subcategories.map((sub) => {
          const isActive = selectedId === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => {
                setSelectedId(sub.id);
                localStorage.setItem(`active_sub_${categoryId}`, String(sub.id));
                onSelectSubcategory(sub.id);
              }}              
              className={`flex flex-col items-center text-center flex-shrink-0 transition-transform duration-200 ${
                isActive ? "scale-[1.05]" : "hover:scale-[1.03]"
              }`}
            >
              {/* 🖼️ Icon */}
              <div
                className={`w-[65px] h-[65px] rounded-full border flex items-center justify-center overflow-hidden shadow-sm transition-all bg-white ${
                  isActive
                    ? "border-[#008080] ring-2 ring-[#B2DFDB]"
                    : "border-gray-200 hover:border-[#008080]"
                }`}
              >
                {sub.icon_image_url ? (
                  <Image
                    src={sub.icon_image_url}
                    alt={sub.name}
                    width={65}
                    height={65}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-xl">🛍️</span>
                )}
              </div>

              <span
                className={`mt-2 text-[12px] sm:text-[13px] font-semibold leading-tight ${
                  isActive ? "text-[#008080]" : "text-gray-800"
                }`}
              >
                {sub.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* ▶ Arrow for desktop */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-200 rounded-full shadow-md w-8 h-8 hidden sm:flex items-center justify-center hover:bg-gray-100"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {/* Scroll indicator for desktop */}
      <div className="hidden sm:block absolute bottom-3 left-4 right-4 h-[3px] bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#008080] transition-all duration-200"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </div>
  );
}
