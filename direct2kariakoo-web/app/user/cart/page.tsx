"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Header from "@/app/user/components/Header";
import { updateCartCache } from "@/lib/cartUtils";

/* -------------------------------------------------------------------------- */
/* 🛒 Cart Page                                                               */
/* -------------------------------------------------------------------------- */
export default function CartPage() {
  const router = useRouter();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  const storageBase = process.env.NEXT_PUBLIC_STORAGE_URL;

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* -------------------------------------------------------------------------- */
  /* 🖼️ Helper: get correct product image URL                                  */
  /* -------------------------------------------------------------------------- */
  const getProductImage = (product: any) => {
    if (!product?.images) return "/placeholder.png";
    const base = storageBase?.replace(/\/$/, "") || "";
    const normalize = (path: string) => {
      if (path.startsWith("http")) return path;
      if (path.startsWith("/")) return `${base}${path}`;
      return `${base}/${path}`;
    };
    if (Array.isArray(product.images) && typeof product.images[0] === "string")
      return normalize(product.images[0]);
    if (Array.isArray(product.images) && product.images[0]?.image)
      return normalize(product.images[0].image);
    if (typeof product.images === "string") return normalize(product.images);
    return "/placeholder.png";
  };

  /* -------------------------------------------------------------------------- */
  /* ⚡ Load from cache instantly + background refresh                         */
  /* -------------------------------------------------------------------------- */
  const fetchCart = async (showLoader = false) => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/user/login");

    if (showLoader) setLoading(true);
    setError("");

    try {
      // ✅ Step 1: Show cached immediately
      const cached = localStorage.getItem("cart_items");
      if (cached && !showLoader) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setCartItems(parsed);
      }

      // ✅ Step 2: Background refresh (always)
      const res = await axios.get(`${apiBaseUrl}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = res.data.items || res.data.cart?.items || [];
      setCartItems(items);
      updateCartCache(items); // cache + trigger event
    } catch (err) {
      console.error("❌ Failed to fetch cart:", err);
      setError("Unable to load cart items.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 🔁 Auto-refresh whenever “cart-updated” event is fired                    */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    fetchCart(); // Load instantly
    const refreshListener = () => fetchCart(false); // fast refresh without loader
    window.addEventListener("cart-updated", refreshListener);
    return () => window.removeEventListener("cart-updated", refreshListener);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* ➕ Increment / ➖ Decrement / ❌ Remove                                    */
  /* -------------------------------------------------------------------------- */
  const updateCart = async (productId: number, quantity: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await axios.post(
        `${apiBaseUrl}/cart/update`,
        { product_id: productId, quantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = res.data.items || [];
      setCartItems(updated);
      updateCartCache(updated);
    } catch (err) {
      console.error("❌ Update failed:", err);
      fetchCart(false);
    }
  };

  const incrementQuantity = (productId: number, currentQty: number) => {
    setCartItems((prev) =>
      prev.map((it) =>
        it.product.id === productId
          ? { ...it, quantity: currentQty + 1 }
          : it
      )
    );
    updateCart(productId, currentQty + 1);
  };

  const decrementQuantity = (productId: number, currentQty: number) => {
    if (currentQty <= 1) return handleRemove(productId);
    setCartItems((prev) =>
      prev.map((it) =>
        it.product.id === productId
          ? { ...it, quantity: currentQty - 1 }
          : it
      )
    );
    updateCart(productId, currentQty - 1);
  };

  const handleRemove = async (productId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setCartItems((prev) => prev.filter((it) => it.product.id !== productId));

    try {
      const res = await axios.post(
        `${apiBaseUrl}/cart/remove`,
        { product_id: productId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = res.data.items || [];
      updateCartCache(updated);
    } catch (err) {
      console.error("❌ Failed to remove item:", err);
      fetchCart(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 💰 Subtotal + Checkout Navigation                                         */
  /* -------------------------------------------------------------------------- */
  const subtotal = cartItems.reduce((sum, it) => {
    const price = Number(it.product?.new_price ?? it.product?.price ?? 0);
    return sum + price * it.quantity;
  }, 0);

  const goToCheckout = () => {
    if (!cartItems.length) return alert("Your cart is empty.");
    localStorage.setItem("checkout_total", subtotal.toString());
    localStorage.setItem("cart_items", JSON.stringify(cartItems));
    router.push("/user/checkout");
  };

  /* -------------------------------------------------------------------------- */
  /* ✨ Shimmer placeholder for smooth loading                                 */
  /* -------------------------------------------------------------------------- */
  const ShimmerItem = () => (
    <div className="flex gap-4 items-center p-4 rounded-xl bg-gray-50 animate-pulse">
      <div className="w-[80px] h-[80px] bg-gray-200 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-gray-200 rounded" />
        <div className="h-3 w-2/3 bg-gray-200 rounded" />
        <div className="h-3 w-1/2 bg-gray-200 rounded" />
      </div>
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 🖥️ UI                                                                    */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ✅ Fast Header */}
      <Header onCategorySelect={() => {}} onSubcategorySelect={() => {}} />

      {/* ✅ Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 lg:flex lg:gap-6">
        {/* 🛒 CART SECTION */}
        <div className="flex-1 bg-white rounded-2xl shadow-md p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-2xl font-bold text-gray-800">
              My Cart ({cartItems.length})
            </h2>
            {cartItems.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear entire cart?")) {
                    setCartItems([]);
                    localStorage.removeItem("cart_items");
                    window.dispatchEvent(new Event("cart-updated"));
                  }
                }}
                className="text-sm text-red-500 hover:text-red-600 transition"
              >
                Clear Cart
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <ShimmerItem key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex justify-center py-24 text-red-500 text-lg">
              {error}
            </div>
          ) : cartItems.length === 0 ? (
            <p className="text-gray-500 text-center py-16 text-base">
              Your cart is empty 🛍️
            </p>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => {
                const product = item.product || {};
                const price = Number(product.new_price ?? product.price ?? 0);
                const totalForItem = price * item.quantity;
                const image = getProductImage(product);

                return (
                  <div
                    key={product.id}
                    className="flex gap-4 items-center bg-gray-50 hover:bg-gray-100 p-4 rounded-xl transition"
                  >
                    <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <Image
                        src={image}
                        alt={product.name || "Product"}
                        width={100}
                        height={100}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex flex-col flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-1">
                        {product.name || "Unnamed Product"}
                      </h3>
                      {product.description && (
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">
                          {product.description.slice(0, 50)}...
                        </p>
                      )}

                      <div className="mt-2 text-sm">
                        <p className="text-gray-600">
                          Price per item:{" "}
                          <span className="font-semibold text-black">
                            TZS {price.toLocaleString()}
                          </span>
                        </p>
                        <p className="font-semibold text-gray-800 mt-1">
                          Total: TZS {totalForItem.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              decrementQuantity(product.id, item.quantity)
                            }
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full w-7 h-7 flex items-center justify-center font-bold"
                          >
                            −
                          </button>
                          <span className="font-medium text-gray-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              incrementQuantity(product.id, item.quantity)
                            }
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full w-7 h-7 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemove(product.id)}
                          className="text-red-500 hover:text-red-600 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 💳 SUMMARY SECTION */}
        <div className="mt-6 lg:mt-0 lg:w-[30%]">
          <div className="bg-white rounded-2xl shadow-md p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Summary</h2>
            <div className="flex justify-between mb-2 text-gray-700">
              <span>Subtotal ({cartItems.length} items)</span>
              <span className="font-medium">
                TZS {subtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-3 mt-2">
              <span>Total</span>
              <span>TZS {subtotal.toLocaleString()}</span>
            </div>
            <button
              onClick={goToCheckout}
              disabled={!cartItems.length}
              className={`w-full mt-6 py-3 font-bold rounded-xl shadow-sm transition ${
                cartItems.length
                  ? "bg-yellow-400 hover:bg-yellow-500 text-black"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
