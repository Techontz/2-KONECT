"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import axios from "axios";
import { ShoppingCart, CheckCircle2, Star, Heart } from "lucide-react";
import { updateCartCache } from "@/lib/cartUtils";

interface Product {
  id: number;
  name: string;
  image: string;
  price: number;
  oldPrice?: number;
  rating?: number;
  reviews?: number;
  attributes?: string[];
}

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adding || added) return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/user/login");
      return;
    }

    // ✅ Instantly show the tick icon
    setAdding(true);
    setAdded(true);

    // ✅ Optimistically update local cache immediately
    try {
      const existing = localStorage.getItem("cart_items");
      let updatedItems = existing ? JSON.parse(existing) : [];
      const existingIndex = updatedItems.findIndex(
        (it: any) => it.product_id === product.id
      );

      if (existingIndex >= 0) {
        updatedItems[existingIndex].quantity += 1;
      } else {
        updatedItems.push({
          product_id: product.id,
          quantity: 1,
          product: product,
        });
      }

      // Save updated cache & trigger header badge instantly
      localStorage.setItem("cart_items", JSON.stringify(updatedItems));
      window.dispatchEvent(new Event("cart-updated"));

      // ✅ Silently send request in background
      axios
        .post(
          `${apiBaseUrl}/cart/add`,
          { product_id: product.id, quantity: 1 },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then((res) => {
          const serverItems = res.data.items || res.data.cart?.items || [];
          updateCartCache(serverItems);
        })
        .catch((err) => {
          console.warn("⚠️ Cart add failed in background:", err.message);
        });
    } catch (err) {
      console.error("❌ Error adding to cart:", err);
    } finally {
      // ✅ keep the tick visible for a moment, then reset
      setTimeout(() => {
        setAdding(false);
        setAdded(false);
      }, 1200);
    }
  };

  return (
    <div
      onClick={() => router.push(`/user/products?id=${product.id}`)}
      className="relative bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* 🔹 Top Label */}
      <div className="absolute top-2 left-2 bg-gray-800 text-white text-xs font-semibold px-2 py-0.5 rounded-md z-10">
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
          src={product.image || "/placeholder.png"}
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
                i < Math.floor(product.rating || 0)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-300"
              }
            />
          ))}
          {product.reviews && (
            <span className="text-xs text-gray-500 ml-1">
              ({product.reviews.toLocaleString()})
            </span>
          )}
        </div>

        {/* 💰 Price */}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold text-[15px] text-gray-900">
            TZS {Number(product.price).toLocaleString("en-TZ")}
          </span>
          {product.oldPrice && (
            <span className="line-through text-xs text-gray-400">
              TZS {product.oldPrice.toLocaleString()}
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
          <div className="text-[10px] text-gray-500 flex items-center gap-1">
            <span>🚚 Selling out fast</span>
          </div>
          <span className="text-[10px] font-semibold text-yellow-500 uppercase">
            express
          </span>
        </div>
      </div>
    </div>
  );
}
