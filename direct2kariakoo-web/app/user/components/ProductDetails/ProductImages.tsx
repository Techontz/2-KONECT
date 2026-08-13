"use client";

import Image from "next/image";
import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ProductImages({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // 🟢 Utility to get full image URL
  const getUrl = (img: any) => {
    if (!img) return "/placeholder.png";
    const path = typeof img === "string" ? img : img.image;
    if (!path) return "/placeholder.png";
    if (path.startsWith("http")) return path;

    const base = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "";
    return `${base}/storage/${path}`;
  };

  // 🟢 Handle next/prev slide in fullscreen
  const nextSlide = () => setActive((prev) => (prev + 1) % images.length);
  const prevSlide = () =>
    setActive((prev) => (prev - 1 + images.length) % images.length);

  // 🟢 Handle keyboard arrows & ESC
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") nextSlide();
    if (e.key === "ArrowLeft") prevSlide();
    if (e.key === "Escape") setFullscreen(false);
  };

  // ✅ Add keyboard event listener when fullscreen
  if (typeof window !== "undefined") {
    window.onkeydown = fullscreen ? handleKey : null;
  }

  return (
    <>
      {/* 🟢 Product image card */}
      <div
        className="bg-white rounded-xl shadow-sm p-4 cursor-zoom-in"
        onClick={() => setFullscreen(true)}
      >
        {/* Main Image */}
        <div className="relative w-full h-[380px] bg-gray-100 rounded-lg overflow-hidden">
          <Image
            src={getUrl(images?.[active])}
            alt="Product"
            fill
            className="object-contain transition-all duration-300"
          />
        </div>

        {/* Thumbnail Strip */}
        {images && images.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
            {images.map((img, i) => (
              <div
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(i);
                }}
                className={`relative w-[70px] h-[70px] rounded-md overflow-hidden border ${
                  i === active ? "border-teal-500" : "border-gray-200"
                } cursor-pointer flex-shrink-0`}
              >
                <Image
                  src={getUrl(img)}
                  alt={`thumb-${i}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🟣 Fullscreen Image Viewer */}
      {fullscreen && (
        <div
          className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen(false);
            }}
          >
            <X size={26} className="text-white" />
          </button>

          {/* Prev Button */}
          {images.length > 1 && (
            <button
              className="absolute left-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
            >
              <ChevronLeft size={30} className="text-white" />
            </button>
          )}

          {/* Next Button */}
          {images.length > 1 && (
            <button
              className="absolute right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
            >
              <ChevronRight size={30} className="text-white" />
            </button>
          )}

          {/* Main fullscreen image */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <Image
              src={getUrl(images?.[active])}
              alt={`fullscreen-${active}`}
              fill
              className="object-contain select-none transition-all duration-300"
            />
          </div>

          {/* Slide indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-6 flex items-center gap-2">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i === active ? "bg-white" : "bg-white/40"
                  }`}
                ></div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🩵 Optional CSS Animations */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
