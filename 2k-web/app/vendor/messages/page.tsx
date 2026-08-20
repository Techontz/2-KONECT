"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import VendorHeader from "../dashboard/components/VendorHeader";

/* -------------------------------------------------------------------------- */
/* 🌟 Vendor Messages Page — Optimized + Shimmer + Cache + Default Avatar      */
/* -------------------------------------------------------------------------- */
export default function VendorMessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const CACHE_KEY_MESSAGES = "d2k_vendor_messages";
  const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  /* -------------------------------------------------------------------------- */
  /* 📡 Fetch conversations from Laravel API                                    */
  /* -------------------------------------------------------------------------- */
  const fetchMessages = async (showLoader = true) => {
    try {
      if (showLoader) setRefreshing(true);

      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️ No token found. Please login again.");
        setLoading(false);
        return;
      }

      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/conversations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = (res.data || []).map((msg: any) => ({
        id: msg.id,
        name: msg.name || "Unknown User",
        avatar:
          msg.avatar && msg.avatar !== "null" && msg.avatar !== ""
            ? msg.avatar
            : "/default-avatar-gray.png",
        lastMessage: msg.lastMessage || "",
        time: msg.time
          ? new Date(msg.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        unread: msg.unread > 0,
      }));

      setMessages(data);

      // ✅ Cache
      localStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(data));
      localStorage.setItem(`${CACHE_KEY_MESSAGES}_time`, Date.now().toString());
    } catch (err) {
      console.error("❌ Error fetching messages:", err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 🧠 Load Cached Vendor + Messages + Auto Refresh                            */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const storedVendor = localStorage.getItem("vendor");
    if (storedVendor) setVendor(JSON.parse(storedVendor));

    const now = Date.now();
    const cached = localStorage.getItem(CACHE_KEY_MESSAGES);
    const cachedTime = localStorage.getItem(`${CACHE_KEY_MESSAGES}_time`);
    if (cached && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY_MS) {
      setMessages(JSON.parse(cached));
      setLoading(false);
    }

    fetchMessages(false);
    const interval = setInterval(() => fetchMessages(false), 30000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* ✨ Shimmer Loader                                                          */
  /* -------------------------------------------------------------------------- */
  const ShimmerList = () => (
    <div className="divide-y bg-white mt-2 px-4 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="flex-1 min-w-0">
            <div className="h-3 w-1/3 bg-gray-200 rounded mb-2" />
            <div className="h-2 w-2/3 bg-gray-100 rounded" />
          </div>
          <div className="w-8 h-3 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 🌀 Loading full-page fallback (initial only)                               */
  /* -------------------------------------------------------------------------- */
  if (loading && messages.length === 0)
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <VendorHeader vendor={vendor} />
        <div className="flex flex-col items-center justify-center h-[70vh] text-gray-500">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center animate-pulse">
            <MessageCircle className="w-10 h-10 text-gray-400" />
          </div>
          <p className="mt-4 font-medium">Loading messages...</p>
        </div>
      </div>
    );

  /* -------------------------------------------------------------------------- */
  /* 🚫 Empty State                                                             */
  /* -------------------------------------------------------------------------- */
  if (!loading && messages.length === 0)
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <VendorHeader vendor={vendor} />
        <div className="flex flex-col items-center justify-center h-[70vh] text-gray-600 animate-fadeIn">
          <div className="w-28 h-28 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <MessageCircle className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="font-semibold text-lg">No messages yet</h3>
          <p className="text-sm text-gray-500">
            Start a chat with a customer or check later.
          </p>
        </div>
      </div>
    );

  /* -------------------------------------------------------------------------- */
  /* 💬 Messages List                                                           */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      <VendorHeader vendor={vendor} />

      {refreshing && (
        <div className="flex justify-center py-2 text-xs text-gray-400 animate-pulse">
          Updating messages...
        </div>
      )}

      <div className="divide-y bg-white mt-2 animate-fadeIn">
        {loading ? (
          <ShimmerList />
        ) : (
          messages.map((m) => {
            const avatarSrc =
              m.avatar && m.avatar !== "null" && m.avatar !== ""
                ? m.avatar
                : "/default-avatar-gray.png";

            return (
              <Link
                key={m.id}
                href={`/vendor/messages/chat?userId=${m.id}&userName=${encodeURIComponent(
                  m.name
                )}&avatar=${encodeURIComponent(avatarSrc)}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition relative"
              >
                <img
                  src={avatarSrc}
                  alt={m.name}
                  className="w-10 h-10 rounded-full object-cover bg-gray-200 border border-gray-100"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).src =
                      "/default-avatar-gray.png")
                  }
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-gray-800">
                    {m.name}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">
                    {m.lastMessage}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-400">{m.time}</span>
                  {m.unread && (
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-1" />
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ✨ Fade Animation Injection (global)                                        */
/* -------------------------------------------------------------------------- */
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn .3s ease-in-out; }
  `;
  if (!document.getElementById("fadein-style")) {
    style.id = "fadein-style";
    document.head.appendChild(style);
  }
}
