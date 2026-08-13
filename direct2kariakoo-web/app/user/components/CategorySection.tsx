"use client";

import Image from "next/image";
import { useState } from "react";

interface Category {
  id: number;
  name: string;
  icon?: string | null;
}

interface Props {
  categories: Category[];
  selected: Category | null;
  onSelect: (cat: Category) => void;
}

export default function CategorySection({
  categories,
  selected,
  onSelect,
}: Props) {
  const [activeId, setActiveId] = useState<number | null>(selected?.id ?? null);

  const handleSelect = (cat: Category) => {
    setActiveId(cat.id);
    onSelect(cat);
  };

  return (
    <section className="bg-white rounded-3xl shadow-sm py-6 px-4 md:px-8 mt-5 border border-gray-100">
      {/* --- Header --- */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="inline-block w-1 h-5 bg-teal-500 rounded-full" />
          Browse Categories
        </h2>

        <button className="text-teal-600 text-sm font-medium hover:text-teal-700 transition flex items-center gap-1">
          See all
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* --- Categories --- */}
      <div
        className="
          flex gap-3 overflow-x-auto scrollbar-hide
          md:grid md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 md:gap-4
          pb-2
        "
      >
        {categories.map((cat) => {
          const safeIcon =
            cat.icon && cat.icon.trim().startsWith("http")
              ? cat.icon.trim()
              : null;
          const isActive = activeId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat)}
              className={`
                flex flex-col items-center justify-center
                flex-shrink-0 w-[90px] md:w-auto
                rounded-2xl px-3 py-4 transition-all duration-300
                ${isActive
                  ? "bg-gradient-to-b from-teal-50 to-white border border-teal-400 shadow-[0_4px_10px_rgba(0,128,128,0.1)] scale-[1.03]"
                  : "bg-white border border-gray-200 hover:border-teal-300 hover:shadow-[0_3px_8px_rgba(0,0,0,0.05)] hover:scale-[1.02]"
                }
              `}
            >
              {/* Icon */}
              <div
                className={`
                  w-16 h-16 flex items-center justify-center mb-2
                  rounded-full overflow-hidden border
                  ${isActive ? "bg-teal-100 border-teal-300" : "bg-gray-100 border-gray-200"}
                `}
              >
                {safeIcon ? (
                  <Image
                    src={safeIcon}
                    alt={cat.name}
                    width={60}
                    height={60}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-gray-400 text-2xl">🛍️</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-[13px] md:text-sm font-semibold text-center leading-tight line-clamp-1
                  ${isActive ? "text-teal-700" : "text-gray-700"}
                `}
              >
                {cat.name}
              </span>

              {/* Active underline */}
              {isActive && (
                <div className="w-3 h-1 bg-teal-500 rounded-full mt-2 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
