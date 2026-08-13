"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import Image from "next/image";
import { ShoppingCart, CheckCircle2, Star, Heart } from "lucide-react";
import Header from "@/app/user/components/Header";

/* -------------------------------------------------------------------------- */
/* 🧠 Cache Settings                                                          */
/* -------------------------------------------------------------------------- */
const memoryCache: Record<string, any[]> = {};
const CACHE_TTL = 1000 * 60 * 5;
const timestampKey = (id: string) => `d2k_products_${id}_timestamp`;

interface Product {
  id: number;
  name: string;
  new_price: number;
  old_price?: number;
  average_rating?: number;
  review_count?: number;
  images: string[];
}

/* -------------------------------------------------------------------------- */
/* 💫 Skeleton Loader                                                         */
/* -------------------------------------------------------------------------- */
function SkeletonLoader() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 px-5 py-8">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm animate-pulse"
        >
          <div className="bg-gray-200 h-44 w-full rounded-md mb-3" />
          <div className="bg-gray-200 h-4 w-3/4 rounded mb-2" />
          <div className="bg-gray-200 h-3 w-1/2 rounded mb-3" />
          <div className="bg-gray-200 h-5 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🟢 Main Inner Component                                                    */
/* -------------------------------------------------------------------------- */
function SubcategoryProductsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subcategoryId = searchParams.get("id");

  const [products, setProducts] = useState<Product[]>([]);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subcategoryId) return;
    const cacheKey = `d2k_products_${subcategoryId}`;
    const now = Date.now();

    // Try memory cache
    if (memoryCache[subcategoryId]) {
      setProducts(memoryCache[subcategoryId]);
      setLoading(false);
    } else {
      // Try localStorage
      const cached = localStorage.getItem(cacheKey);
      const timestamp = Number(localStorage.getItem(timestampKey(subcategoryId)));
      if (cached && timestamp && now - timestamp < CACHE_TTL) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setProducts(parsed);
            memoryCache[subcategoryId] = parsed;
            setLoading(false);
          }
        } catch {}
      }
    }

    // Fetch fresh data
    const fetchProducts = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/subcategories/${subcategoryId}/products`
        );
        const data = Array.isArray(res.data.products)
          ? res.data.products
          : [];
        setProducts(data);
        memoryCache[subcategoryId] = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(timestampKey(subcategoryId), now.toString());
        if (res.data.subcategory?.name)
          setSubcategoryName(res.data.subcategory.name);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [subcategoryId]);

  if (loading && products.length === 0)
    return (
      <div className="bg-gray-50 min-h-screen">
        <Header onCategorySelect={() => {}} onSubcategorySelect={() => {}} />
        <SkeletonLoader />
      </div>
    );

  return (
    <>
      <Header onCategorySelect={() => {}} onSubcategorySelect={() => {}} />
      <div className="bg-[#F9FAFB] min-h-screen pt-2 pb-10">
        <div className="flex items-center justify-between px-5 md:px-8 py-4">
          <h2 className="text-xl md:text-2xl font-extrabold text-[#272B37] capitalize">
            {subcategoryName || "All Products"}
          </h2>
          <button
            onClick={() => router.back()}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-sm rounded-md"
          >
            ← Back
          </button>
        </div>

        {products.length === 0 ? (
          <p className="text-gray-500 text-center pb-10">
            No products available in this subcategory.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 px-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 🛒 Product Card (Updated with Comma Formatting)                            */
/* -------------------------------------------------------------------------- */
function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);

  const price = product.new_price;
  const oldPrice = product.old_price || 0;
  const discount =
    oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const rating = product.average_rating || 0;
  const reviews = product.review_count || 0;

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("en-TZ").format(value);

  const imageUrl =
    product.images?.[0]?.startsWith("http")
      ? product.images[0]
      : `${process.env.NEXT_PUBLIC_STORAGE_URL}/${product.images?.[0] || "placeholder.png"}`;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adding) return;
    const token = localStorage.getItem("token");
    if (!token) return router.push("/user/login");
    setAdding(true);
    setAdded(true);

    try {
      const existing = localStorage.getItem("cart_items");
      let updatedItems = existing ? JSON.parse(existing) : [];
      const idx = updatedItems.findIndex((it: any) => it.product_id === product.id);
      if (idx >= 0) updatedItems[idx].quantity += 1;
      else updatedItems.push({ product_id: product.id, quantity: 1, product });

      localStorage.setItem("cart_items", JSON.stringify(updatedItems));
      window.dispatchEvent(new Event("cart-updated"));

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/cart/add`,
        { product_id: product.id, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.warn("Cart add failed:", err);
    } finally {
      setTimeout(() => {
        setAdded(false);
        setAdding(false);
      }, 1200);
    }
  };

  return (
    <div
      onClick={() => router.push(`/user/products?id=${product.id}`)}
      className="relative bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* 🔹 Top Label */}
      <div className="absolute top-2 left-2 bg-gray-800 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md z-10">
        Best Seller
      </div>

      {/* ❤️ Wishlist Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setLiked(!liked);
        }}
        className="absolute top-2 right-2 bg-white rounded-full shadow p-1 z-10 hover:scale-105 transition"
      >
        <Heart
          size={16}
          className={liked ? "text-red-500 fill-red-500" : "text-gray-400"}
        />
      </button>

      {/* 🖼️ Product Image */}
      <div className="relative w-full h-48 bg-gray-100">
        <Image
          src={imageUrl || "/placeholder.png"}
          alt={product.name}
          fill
          className="object-contain p-4"
          sizes="250px"
        />

        {/* 🛒 Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={adding}
          className="absolute bottom-2 right-2 bg-white rounded-lg shadow p-2 hover:bg-gray-100 transition"
        >
          {added ? (
            <CheckCircle2 className="text-green-600" size={18} />
          ) : adding ? (
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShoppingCart className="text-gray-700" size={18} />
          )}
        </button>
      </div>

      {/* 🧾 Product Details */}
      <div className="px-3 py-2 flex flex-col flex-grow">
        <h3 className="font-medium text-sm text-gray-800 line-clamp-2 leading-snug min-h-[38px]">
          {product.name}
        </h3>

        {/* ⭐ Rating */}
        <div className="flex items-center gap-1 mt-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={13}
              className={
                i < Math.floor(rating)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-300"
              }
            />
          ))}
          {reviews > 0 && (
            <span className="text-xs text-gray-500 ml-1">
              ({reviews.toLocaleString()})
            </span>
          )}
        </div>

        {/* 💰 Price */}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold text-[15px] text-gray-900">
            TZS {formatPrice(price)}
          </span>
          {oldPrice > 0 && (
            <span className="line-through text-xs text-gray-400">
              TZS {formatPrice(oldPrice)}
            </span>
          )}
          {discount > 0 && (
            <span className="text-green-600 text-xs font-medium">
              {discount}% OFF
            </span>
          )}
        </div>

        {/* 🔹 Express/Badge Row */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-500">🚚 Selling out fast</span>
          <span className="text-[10px] font-semibold text-yellow-500 uppercase">
            express
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ✅ Suspense Wrapper                                                        */
/* -------------------------------------------------------------------------- */
export default function SubcategoryProductsPage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <SubcategoryProductsInner />
    </Suspense>
  );
}
