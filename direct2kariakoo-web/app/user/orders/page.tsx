"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  name: string;
  images?: { image: string }[] | string[];
}

interface Vendor {
  business_name?: string;
  business_address?: string;
  phone?: string;
  logo?: string;
}

interface Order {
  id: number;
  status: string;
  total: number;
  quantity: number;
  created_at: string;
  product?: Product;
  vendor?: Vendor;
}

/* -------------------------------------------------------------------------- */
/* ⚡ Cache settings                                                          */
/* -------------------------------------------------------------------------- */
const CACHE_KEY = "d2k_orders_cache";
const CACHE_TIME = "d2k_orders_cache_time";
const CACHE_EXPIRY = 1000 * 60 * 10; // 10 minutes

export default function OrdersPage() {
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_API_URL;
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL;

  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* 🧠 Load orders (cache-first)                                               */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    const fetchOrders = async () => {
      const now = Date.now();
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME);

      // 🧠 Load from cache instantly if still fresh
      if (cached && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY) {
        try {
          const parsed = JSON.parse(cached);
          setOrders(parsed);
          setLoadedFromCache(true);
        } catch {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_TIME);
        }
      }

      const token = localStorage.getItem("token");
      if (!token) return router.push("/user/login");

      try {
        setIsFetching(true);
        const res = await axios.get(`${api}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let fetchedOrders = res.data.orders || [];
        if (!Array.isArray(fetchedOrders)) {
          fetchedOrders = Object.values(fetchedOrders).flat();
        }

        if (!cancelled) {
          setOrders(fetchedOrders);
          localStorage.setItem(CACHE_KEY, JSON.stringify(fetchedOrders));
          localStorage.setItem(CACHE_TIME, now.toString());
        }
      } catch (err) {
        console.error("❌ Fetch orders error:", err);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [api, router]);

  /* -------------------------------------------------------------------------- */
  /* 🧩 Categorize orders                                                       */
  /* -------------------------------------------------------------------------- */
  const activeOrders = orders.filter(
    (o) =>
      o.status === "pending" ||
      o.status === "paid" ||
      o.status === "processing"
  );
  const historyOrders = orders.filter(
    (o) => o.status === "completed" || o.status === "failed"
  );
  const refundOrders = orders.filter((o) => o.status === "refunded");

  const getDisplayStatus = (status: string) => {
    const map: Record<string, string> = {
      pending: "Pending",
      paid: "Paid",
      processing: "In Progress",
      completed: "Completed",
      failed: "Failed",
      refunded: "Refunded",
    };
    return map[status] || status;
  };

  /* -------------------------------------------------------------------------- */
  /* 💎 Shimmer skeleton loader                                                 */
  /* -------------------------------------------------------------------------- */
  const ShimmerCard = () => (
    <div className="animate-pulse bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex">
        <div className="w-24 h-24 bg-gray-200" />
        <div className="flex-1 p-3 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/4 mt-2" />
        </div>
      </div>
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 🎨 Render order list                                                      */
  /* -------------------------------------------------------------------------- */
  const renderOrders = (list: Order[], emptyText: string) => (
    <AnimatePresence mode="wait">
      {isFetching && !loadedFromCache ? (
        <motion.div
          key="shimmer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-3 mt-4"
        >
          {[1, 2, 3, 4].map((i) => (
            <ShimmerCard key={i} />
          ))}
        </motion.div>
      ) : list.length === 0 ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center py-20 text-gray-400 text-sm"
        >
          {emptyText}
        </motion.div>
      ) : (
        <motion.div
          key="orders"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-4"
        >
          {list.map((order) => {
            const image =
              typeof order.product?.images?.[0] === "string"
                ? order.product?.images?.[0]
                : order.product?.images?.[0]?.image;

            const vendor = order.vendor || (order as any).vendor_data;
            const vendorName =
              vendor?.business_name || vendor?.name || "Unknown Vendor";
            const vendorAddress =
              vendor?.business_address || vendor?.location || "N/A";
            const vendorPhone = vendor?.phone || "";
            const vendorLogo = vendor?.logo
              ? vendor.logo.startsWith("http")
                ? vendor.logo
                : `${storageUrl}/${vendor.logo}`
              : null;

            const status = getDisplayStatus(order.status);
            const color =
              order.status === "completed"
                ? "bg-green-100 text-green-700"
                : order.status === "paid" || order.status === "processing"
                ? "bg-blue-100 text-blue-700"
                : order.status === "failed"
                ? "bg-red-100 text-red-700"
                : order.status === "refunded"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700";

            return (
              <motion.div
                key={order.id}
                layout
                className="flex bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300"
              >
                {/* 🖼️ Product Image */}
                <div className="w-24 h-24 bg-gray-50 flex-shrink-0">
                  {image ? (
                    <img
                      src={
                        image.startsWith("http")
                          ? image
                          : `${storageUrl}/${image}`
                      }
                      alt={order.product?.name || "Product"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No Image
                    </div>
                  )}
                </div>

                {/* 📦 Order Info */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {vendorLogo ? (
                        <img
                          src={vendorLogo}
                          alt={vendorName}
                          className="w-7 h-7 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
                          {vendorName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <p className="text-sm font-semibold text-gray-800 leading-tight">
                        {vendorName}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${color}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    {vendorAddress}
                  </div>

                  <div className="mt-2">
                    <h3 className="font-medium text-gray-900 text-[15px] line-clamp-1">
                      {order.product?.name || "Product"}
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                      Qty: {order.quantity} •{" "}
                      <span className="font-semibold text-gray-900">
                        TZS {order.total.toLocaleString()}
                      </span>
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                    {vendorPhone && (
                      <a
                        href={`tel:${vendorPhone}`}
                        className="flex items-center gap-1 text-sm text-teal-700 font-medium hover:text-teal-800 transition"
                      >
                        <Phone className="w-4 h-4" />
                        {vendorPhone}
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* -------------------------------------------------------------------------- */
  /* ✨ Render page layout                                                      */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white shadow-sm border-b border-gray-100 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-black transition"
          >
            <ArrowLeft size={22} />
            <span className="font-medium hidden sm:inline">Back</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            My Orders
          </h1>
          <div className="w-[30px] sm:w-[60px]" />
        </div>

        {/* Tabs */}
        <div className="flex mx-4 my-3 bg-white rounded-lg overflow-hidden border border-gray-200">
          {["Active Orders", "Order History", "Refunds"].map((t, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                selected === i
                  ? "bg-black text-white"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {selected === 0 &&
          renderOrders(activeOrders, "No active orders found.")}
        {selected === 1 &&
          renderOrders(historyOrders, "No order history yet.")}
        {selected === 2 &&
          renderOrders(refundOrders, "No refund requests yet.")}
      </div>
    </div>
  );
}
