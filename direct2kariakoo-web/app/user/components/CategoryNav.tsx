"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  categories: { id: number; name: string }[];
  activeCategory: { id: number; name: string } | null;
  onHover: (cat: any) => void;
  onLeave: () => void;
}

export default function CategoryNav({
  categories,
  activeCategory,
  onHover,
  onLeave,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  
  /* -------------------------------------------------------------------------- */
  /* 🔹 Keep the selected category always visible                               */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (selectedCategory !== null) {
      const el = document.getElementById(`cat-${selectedCategory}`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  }, [selectedCategory]);

  /* -------------------------------------------------------------------------- */
  /* 🔹 Check scroll visibility                                                 */
  /* -------------------------------------------------------------------------- */
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  };

  /* -------------------------------------------------------------------------- */
  /* 🔹 Scroll handler                                                          */
  /* -------------------------------------------------------------------------- */
  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 250;
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  /* -------------------------------------------------------------------------- */
  /* 🔹 Add scroll listeners                                                    */
  /* -------------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------- */
  /* 🔹 Component UI                                                            */
  /* -------------------------------------------------------------------------- */
  return (
    <div
      className="relative bg-white border-t border-gray-200 shadow-sm select-none"
      onMouseLeave={onLeave}
    >
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md hover:bg-gray-100 p-1 rounded-full"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {/* Categories */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide gap-6 text-gray-800 font-semibold text-sm py-2 px-10 scroll-smooth"
      >
        {categories.map((cat) => {
          const isActive =
            activeCategory?.id === cat.id || selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              id={`cat-${cat.id}`}
              onClick={() => {
                setSelectedCategory(cat.id);
                onHover(cat);
              }}
              className={`relative flex-shrink-0 px-1 pb-1 transition ${
                isActive
                  ? "text-black border-b-2 border-black"
                  : "text-gray-800 hover:text-black"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md hover:bg-gray-100 p-1 rounded-full"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      )}
    </div>
  );
}
