"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import Header from "@/app/user/components/Header";

/* ----------------------------- Interfaces ----------------------------- */
interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
  icon_image_url?: string | null;
}

/* -------------------------------------------------------------------------- */
/*               DIRECT2KARIAKOO ALIEXPRESS-STYLE CATEGORY PAGE               */
/* -------------------------------------------------------------------------- */
export default function CategoryScreen() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*                      ✅ LOAD FROM LOCAL STORAGE FIRST                      */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    try {
      const cachedCats = localStorage.getItem("d2k_categories");
      if (cachedCats) {
        const parsed = JSON.parse(cachedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          setSelectedCategory(parsed[0]);
          setLoading(false);
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed to load cached categories:", err);
    }

    // Fetch fresh categories from server in background
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories`)
      .then((res) => {
        const cats = Array.isArray(res.data) ? res.data : [];
        setCategories(cats);
        if (!selectedCategory && cats.length > 0) setSelectedCategory(cats[0]);
        localStorage.setItem("d2k_categories", JSON.stringify(cats));
      })
      .catch((err) => console.error("❌ Error fetching categories:", err))
      .finally(() => setLoading(false));
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                   ✅ LOAD SUBCATEGORIES (with local cache)                 */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (!selectedCategory) return;
    setSubLoading(true);

    const cacheKey = `d2k_subcategories_${selectedCategory.id}`;
    const cachedSubs = localStorage.getItem(cacheKey);

    if (cachedSubs) {
      try {
        const parsed = JSON.parse(cachedSubs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSubcategories(parsed);
          setSubLoading(false);
        }
      } catch {}
    }

    // Fetch fresh data anyway to keep updated
    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/${selectedCategory.id}/subcategories`
      )
      .then((res) => {
        const subs = Array.isArray(res.data) ? res.data : [];
        setSubcategories(subs);
        localStorage.setItem(cacheKey, JSON.stringify(subs));
      })
      .catch((err) => console.error("❌ Error fetching subcategories:", err))
      .finally(() => setSubLoading(false));
  }, [selectedCategory]);

  /* ------------------------------ Page Layout ----------------------------- */
  return (
    <div className="bg-white min-h-screen">
      {/* ✅ Global Header */}
      <Header onCategorySelect={() => {}} onSubcategorySelect={() => {}} />

      {/* ✅ Two-column layout (always visible) */}
      <div className="flex h-[calc(100vh-120px)] overflow-hidden">
        {/* LEFT SIDEBAR: Categories */}
        <aside className="w-[35%] bg-gray-50 border-r border-gray-100 overflow-y-auto">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full px-4 py-3 border-b border-gray-100 animate-pulse"
                >
                  <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                </div>
              ))
            : categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    w-full text-left px-4 py-3 text-[13px] font-medium
                    transition-all duration-200 border-b border-gray-100
                    ${
                      selectedCategory?.id === cat.id
                        ? "bg-white text-teal-600 border-l-4 border-teal-600 font-semibold"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }
                  `}
                >
                  {cat.name}
                </button>
              ))}
        </aside>

        {/* RIGHT CONTENT: Subcategories */}
        <main className="flex-1 overflow-y-auto px-4 py-3">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-3">
            {selectedCategory?.name || "Recommended"}
          </h2>

          {subLoading || loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[60px] h-[75px] bg-gray-100 rounded-md mx-auto"
                />
              ))}
            </div>
          ) : subcategories.length === 0 ? (
            <p className="text-gray-400 text-sm">No subcategories found.</p>
          ) : (
            <div
              className="
                grid gap-3
                grid-cols-3
                sm:grid-cols-4
                md:grid-cols-5
                lg:grid-cols-6
              "
            >
              {subcategories.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => router.push(`/user/subcategories?id=${sub.id}`)}
                  className="
                    flex flex-col items-center text-center cursor-pointer
                    hover:scale-[1.04] transition-transform duration-200
                  "
                >
                  <div
                    className="
                      w-[60px] h-[60px]
                      sm:w-[70px] sm:h-[70px]
                      md:w-[80px] md:h-[80px]
                      bg-gray-50 rounded-lg
                      border border-gray-100
                      flex items-center justify-center overflow-hidden
                      shadow-sm
                    "
                  >
                    {sub.icon_image_url ? (
                      <Image
                        src={sub.icon_image_url}
                        alt={sub.name}
                        width={80}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-xl sm:text-2xl">🛍️</span>
                    )}
                  </div>
                  <span
                    className="
                      text-[11px] sm:text-[12px] md:text-[13px]
                      text-gray-700 mt-1 leading-tight
                      line-clamp-2
                    "
                  >
                    {sub.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
