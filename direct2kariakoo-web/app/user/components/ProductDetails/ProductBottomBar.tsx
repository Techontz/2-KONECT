"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { updateCartCache } from "@/lib/cartUtils";

export default function ProductBottomBar({
  price,
  productId,
}: {
  price: number;
  productId: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* 🛒 Add to Cart + Sync Header Badge */
  /* -------------------------------------------------------------------------- */
  const handleAddToCart = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in first.");
        router.push("/user/login");
        return;
      }

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/cart/add`,
        { product_id: productId, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // ✅ Extract updated cart items and sync globally
      const updatedItems = res.data.items || res.data.cart?.items || [];
      updateCartCache(updatedItems);

      alert("🛒 Product added to cart!");
    } catch (err: any) {
      console.error("❌ Add to cart error:", err);
      alert("Failed to add product to cart. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* ⚡ Buy Now (Single-item checkout) */
  /* -------------------------------------------------------------------------- */
  const handleBuyNow = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in first.");
      router.push("/user/login");
      return;
    }
  
    try {
      setLoading(true);
  
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/cart/add`,
        { product_id: productId, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      const updatedItems = res.data.items || res.data.cart?.items || [];
      updateCartCache(updatedItems);
  
      router.push("/user/checkout");
    } catch (err) {
      console.error("❌ Buy now error:", err);
      alert("Failed to proceed. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  /* -------------------------------------------------------------------------- */
  /* 🖥️ UI */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-6 flex items-center justify-between shadow-lg z-50">
      {/* Price Section */}
      <div>
        <p className="text-gray-500 text-xs">Price</p>
        <p className="font-bold text-lg text-gray-900">
          TZS {price?.toLocaleString()}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* 🛒 Add to Cart */}
        <button
          disabled={loading}
          onClick={handleAddToCart}
          className={`px-4 py-2 rounded-lg font-semibold border border-gray-200 transition ${
            loading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
          }`}
        >
          {loading ? "Adding..." : "Add to Cart"}
        </button>

        {/* 💳 Buy Now */}
        <button
          onClick={handleBuyNow}
          className="bg-yellow-400 text-black px-5 py-2 rounded-lg font-bold hover:bg-yellow-500 transition"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
