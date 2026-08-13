"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import BannerCarousel from "@/app/user/components/BannerCarousel";
import ProductCard from "@/app/user/components/ProductCard";
import SubcategorySection from "@/app/user/components/SubcategorySection";
import ProductGrid from "../components/ProductGrid";

/* -------------------------------------------------------------------------- */
/* Interfaces                                                                 */
/* -------------------------------------------------------------------------- */
interface Product {
  id: number;
  name: string;
  new_price: number;
  old_price?: number;
  average_rating?: number;
  review_count?: number;
  images: string[];
  attribute_values?: { value: string }[];
}
interface Category {
  id: number;
  name: string;
}
interface Subcategory {
  id: number;
  name: string;
}

/* -------------------------------------------------------------------------- */
/* Cache Constants                                                            */
/* -------------------------------------------------------------------------- */
const CAT_CACHE_KEY = "d2k_home_categories";
const CAT_CACHE_TIME = "d2k_home_cache_time";
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
/* -------------------------------------------------------------------------- */
/* 🔹 Product Cache Helpers                                                    */
/* -------------------------------------------------------------------------- */

const PRODUCT_CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

const getProductCache = (subId: number) => {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(`products_sub_${subId}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time < PRODUCT_CACHE_TTL) {
      return parsed.data;
    }
  } catch {}
  return null;
};

const setProductCache = (subId: number, data: Product[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `products_sub_${subId}`,
    JSON.stringify({ data, time: Date.now() })
  );
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export default function HomePage() {
  const router = useRouter();

  // ✅ Initialize instantly with cached data
  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(CAT_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
      }
    }
    return [];
  });

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: any) => {
      if (!selectedSubcategory) {
        setSelectedSubcategory(e.detail);
      }
    };
  
    window.addEventListener("auto-select-subcategory", handler);
    return () => window.removeEventListener("auto-select-subcategory", handler);
  }, [selectedSubcategory]);
  
  /* -------------------------------------------------------------------------- */
  /* 🔹 Load / Refresh Categories in Background                                 */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const now = Date.now();
    const cachedTime = localStorage.getItem(CAT_CACHE_TIME);

    // show cached instantly
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }

    // skip if still fresh
    if (cachedTime && now - parseInt(cachedTime) < CACHE_TTL) return;

    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        if (data.length > 0) {
          setCategories(data);
          if (!selectedCategory) setSelectedCategory(data[0]);
          localStorage.setItem(CAT_CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(CAT_CACHE_TIME, now.toString());
        }
      })
      .catch((err) => {
        console.error("⚠️ Category refresh failed", err);
        setError("Failed to refresh categories.");
      });
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 🧱 Layout                                                                  */
  /* -------------------------------------------------------------------------- */
  return (
    <main className="bg-gray-50 min-h-screen pb-20">
      {/* ✅ Header */}
      <Header
        onCategorySelect={(cat) => {
          if (!cat || selectedCategory?.id === cat.id) return;
        
          setSelectedCategory(cat);
        
          // 🔥 RESET subcategory when category changes
          setSelectedSubcategory(null);
        }}        
        onSubcategorySelect={(id) => {
          if (!id || selectedSubcategory === id) return;
          setSelectedSubcategory(id);
        }}
      />

      {/* ✅ Banner */}
      <div className="mt-2 sm:mt-4">
        <BannerCarousel />
      </div>

      {/* ✅ Subcategory Section */}
      {selectedCategory && (
        <SubcategorySection
          key={selectedCategory.id}
          categoryId={selectedCategory.id}
          onSelectSubcategory={(id) => setSelectedSubcategory(id)}
        />
      )}

      {/* ✅ Products by Subcategory */}
      {selectedCategory && (
        <ProductsBySubcategoryRows
          categoryId={selectedCategory.id}
          selectedSubcategory={selectedSubcategory}
        />
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* 🧩 Products by Subcategory Rows Component                                   */
/* -------------------------------------------------------------------------- */
function ProductsBySubcategoryRows({
  categoryId,
  selectedSubcategory,
}: {
  categoryId: number;
  selectedSubcategory: number | null;
}) {
  const router = useRouter();

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [productsBySub, setProductsBySub] = useState<Record<number, Product[]>>({});
  const [loadedSubs, setLoadedSubs] = useState<Record<number, boolean>>({});

  /* ------------------------------------------------
     LOAD SUBCATEGORIES ON CATEGORY CHANGE
  -------------------------------------------------*/
  useEffect(() => {
    let cancelled = false;

    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/categories/${categoryId}/subcategories`)
      .then(res => {
        if (cancelled) return;
        const subs = Array.isArray(res.data) ? res.data : [];
        setSubcategories(subs);

        // auto-select first subcategory
        if (!selectedSubcategory && subs.length > 0) {
          window.dispatchEvent(
            new CustomEvent("auto-select-subcategory", { detail: subs[0].id })
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  /* ------------------------------------------------
     LOAD PRODUCTS WHEN SUBCATEGORY CHANGES
  -------------------------------------------------*/
  useEffect(() => {
    if (!selectedSubcategory) return;

    // 👇 force shimmer immediately
    setLoadedSubs(prev => ({
      ...prev,
      [selectedSubcategory]: false,
    }));

    // 👇 cache check
    const cached = getProductCache(selectedSubcategory);
    if (cached) {
      setProductsBySub(prev => ({
        ...prev,
        [selectedSubcategory]: cached,
      }));
      setLoadedSubs(prev => ({
        ...prev,
        [selectedSubcategory]: true,
      }));
      return;
    }

    let cancelled = false;

    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_URL}/subcategories/${selectedSubcategory}/products`
      )
      .then(res => {
        if (cancelled) return;

        const products = Array.isArray(res.data.products)
          ? res.data.products
          : [];

        setProductsBySub(prev => ({
          ...prev,
          [selectedSubcategory]: products,
        }));

        setLoadedSubs(prev => ({
          ...prev,
          [selectedSubcategory]: true,
        }));

        setProductCache(selectedSubcategory, products);
      })
      .catch(() => {
        setLoadedSubs(prev => ({
          ...prev,
          [selectedSubcategory]: true,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubcategory]);

  /* ------------------------------------------------
     RENDER — NEVER BLANK
  -------------------------------------------------*/
  const validSub = subcategories.find(s => s.id === selectedSubcategory);

  if (!selectedSubcategory) {
    return (
      <section className="mt-5 px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-[260px] bg-gray-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }  

  const sub =
    subcategories.find(s => s.id === selectedSubcategory) || {
      id: selectedSubcategory,
      name: "Loading…",
    };

  return (
    <section className="mt-5 px-4 space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold">{sub.name}</h2>
        <button
          onClick={() => router.push(`/user/subcategories?id=${sub.id}`)}
          className="text-teal-600 text-xs"
        >
          See all →
        </button>
      </div>

      {/* Product Row */}
      <div className="w-full">
          {/* SHIMMER */}
          {!loadedSubs[sub.id] && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[260px] bg-gray-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          )}

          {/* EMPTY */}
          {loadedSubs[sub.id] &&
            (productsBySub[sub.id]?.length ?? 0) === 0 && (
              <div className="text-center text-gray-400 py-10">
                No products found
              </div>
            )}

          {/* PRODUCTS — VERTICAL SCROLL */}
          {loadedSubs[sub.id] &&
            productsBySub[sub.id]?.length > 0 && (
              <ProductGrid products={productsBySub[sub.id]} />
            )}
        </div>
    </section>
  );
}
