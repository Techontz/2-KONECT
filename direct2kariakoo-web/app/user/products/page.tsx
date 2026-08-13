"use client";

import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import axios from "axios";
import ProductDetails from "@/app/user/components/ProductDetails";
import { useSearchParams } from "next/navigation";

/* -------------------------------------------------------------------------- */
/* 🧠 AXIOS FETCHER (Simple + Reliable)                                       */
/* -------------------------------------------------------------------------- */
const fetcher = async (url: string) => {
  const res = await axios.get(url);
  return res.data.product || res.data;
};

/* -------------------------------------------------------------------------- */
/* 💫 SKELETON / SHIMMER LOADER                                              */
/* -------------------------------------------------------------------------- */
function ProductSkeleton() {
  return (
    <div className="animate-pulse bg-gray-50 min-h-screen px-6 py-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: image placeholder */}
        <div className="bg-gray-200 h-96 w-full rounded-lg" />
        {/* Right: content placeholders */}
        <div className="flex flex-col gap-4">
          <div className="h-6 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
          <div className="h-5 w-2/3 bg-gray-200 rounded" />
          <div className="h-5 w-1/3 bg-gray-200 rounded" />
          <div className="h-40 w-full bg-gray-100 rounded-lg mt-6" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ⚙️ PRODUCT DETAILS INNER COMPONENT                                         */
/* -------------------------------------------------------------------------- */
function ProductDetailsInner() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const [cachedProduct, setCachedProduct] = useState<any>(null);

  /* -------------------------------------------------------------------------- */
  /* ✅ Use SWR with background refresh + cache                                 */
  /* -------------------------------------------------------------------------- */
  const {
    data: product,
    error,
    isLoading,
    mutate,
  } = useSWR(
    productId
      ? `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true, // Refresh when user switches back to tab
      refreshInterval: 15000, // Background refresh every 15s
      dedupingInterval: 60000, // Keep cache fresh for 1 min
    }
  );

  /* -------------------------------------------------------------------------- */
  /* ⚡️ Load cached product instantly before fetch                             */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (!productId) return;

    const cacheKey = `d2k_product_${productId}`;

    // Load from cache for instant UI
    const cached = localStorage.getItem(cacheKey);
    if (cached && !product) {
      try {
        const parsed = JSON.parse(cached);
        setCachedProduct(parsed);
        mutate(parsed, false); // Show cached version instantly
      } catch {
        console.warn("⚠️ Failed to parse cached product data");
      }
    }

    // Save to cache whenever SWR fetches fresh data
    if (product) {
      localStorage.setItem(cacheKey, JSON.stringify(product));
      setCachedProduct(product);
    }
  }, [product, productId, mutate]);

  /* -------------------------------------------------------------------------- */
  /* 🚨 Error State                                                            */
  /* -------------------------------------------------------------------------- */
  if (error)
    return (
      <div className="flex justify-center items-center h-screen text-red-600">
        {error.message || "Failed to load product."}
      </div>
    );

  /* -------------------------------------------------------------------------- */
  /* 💫 Loading State (use skeleton)                                           */
  /* -------------------------------------------------------------------------- */
  if (isLoading && !cachedProduct) return <ProductSkeleton />;

  /* -------------------------------------------------------------------------- */
  /* ✅ Render Product Details                                                 */
  /* -------------------------------------------------------------------------- */
  return <ProductDetails product={product || cachedProduct} />;
}

/* -------------------------------------------------------------------------- */
/* 🚀 PAGE WRAPPER (with Suspense Boundary)                                   */
/* -------------------------------------------------------------------------- */
export default function ProductDetailsPage() {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetailsInner />
    </Suspense>
  );
}
