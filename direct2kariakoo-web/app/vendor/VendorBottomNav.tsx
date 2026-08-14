"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Package, MessageSquare, Settings } from "lucide-react";
import { useT } from "@/lib/i18n";

/* -------------------------------------------------------------------------- */
/* 🌟 Vendor Bottom Navigation — Persistent Cache + Live Counts               */
/* -------------------------------------------------------------------------- */
// Labels are dictionary paths: this array is module-level, so it cannot call
// the translation hook, and the text must re-render when the language changes.
const navItems = [
  { label: "seller.dashboard", href: "/vendor/dashboard", icon: Home },
  { label: "seller.orders", href: "/vendor/orders", icon: Package },
  { label: "chat.title", href: "/vendor/messages", icon: MessageSquare },
  { label: "seller.storeSettings", href: "/vendor/settings", icon: Settings },
] as const;

export default function VendorBottomNav() {
  const t = useT();
  const pathname = usePathname();
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const CACHE_KEY_ACTIVE = "vendor_bottom_nav_active";
  const CACHE_KEY_COUNTS = "vendor_bottom_nav_counts";
  const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  /* -------------------------------------------------------------------------- */
  /* ⚡ Load Cached Tab + Cached Counts Instantly                               */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const now = Date.now();

    const cachedActive = localStorage.getItem(CACHE_KEY_ACTIVE);
    const cachedCounts = localStorage.getItem(CACHE_KEY_COUNTS);
    const cachedTime = localStorage.getItem(`${CACHE_KEY_COUNTS}_time`);

    // ✅ load cached active tab
    if (cachedActive) setActive(cachedActive);

    // ✅ load cached counts instantly
    if (cachedCounts && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY_MS) {
      try {
        const parsed = JSON.parse(cachedCounts);
        setUnreadCount(parsed.unread || 0);
        setPendingCount(parsed.pending || 0);
      } catch {}
    }

    setLoading(false);
    fetchCounts(false); // silent refresh on mount

    // ✅ auto refresh every minute
    const interval = setInterval(() => fetchCounts(false), 60000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 📍 Watch path changes & cache last active tab                              */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (pathname) {
      setActive(pathname);
      localStorage.setItem(CACHE_KEY_ACTIVE, pathname);
    }
  }, [pathname]);

  /* -------------------------------------------------------------------------- */
  /* 📡 Fetch Counts (Unread messages & Pending orders)                         */
  /* -------------------------------------------------------------------------- */
  const fetchCounts = async (showLog = true) => {
    try {
      const token = localStorage.getItem("token");
      if (!token || !API_URL) return;

      let newUnread = unreadCount;
      let newPending = pendingCount;

      // 🔹 Messages
      const msgRes = await fetch(`${API_URL}/messages/count-unread-messages/0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        newUnread = Number(msgData?.count || msgData?.unread || 0);
        setUnreadCount(newUnread);
      }

      // 🔹 Orders
      const orderRes = await fetch(`${API_URL}/vendor/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const orders = orderData?.orders || [];
        newPending = orders.filter(
          (o: any) =>
            o?.status?.toLowerCase() === "pending" ||
            o?.status?.toLowerCase() === "paid" ||
            o?.status?.toLowerCase() === "processing"
        ).length;
        setPendingCount(newPending);
      }

      // ✅ cache results
      localStorage.setItem(
        CACHE_KEY_COUNTS,
        JSON.stringify({ unread: newUnread, pending: newPending })
      );
      localStorage.setItem(`${CACHE_KEY_COUNTS}_time`, Date.now().toString());
    } catch (err) {
      if (showLog) console.error("❌ Failed to fetch counts:", err);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* ✨ Shimmer Loader                                                          */
  /* -------------------------------------------------------------------------- */
  const Shimmer = () => (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-100 h-[68px] flex justify-around items-center md:hidden animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 bg-gray-200 rounded-full" />
          <div className="w-8 h-2 bg-gray-100 rounded" />
        </div>
      ))}
    </nav>
  );

  if (loading) return <Shimmer />;

  /* -------------------------------------------------------------------------- */
  /* 🧱 Render Navigation                                                       */
  /* -------------------------------------------------------------------------- */
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-100 h-[70px] flex justify-around items-center md:hidden shadow-[0_-3px_10px_rgba(0,0,0,0.1)] animate-fadeIn">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive = active?.startsWith(href);
        const count =
          label === "chat.title"
            ? unreadCount
            : label === "seller.orders"
            ? pendingCount
            : 0;

        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center justify-center transition-all duration-200 ${
              isActive ? "scale-110" : "opacity-90 hover:opacity-100"
            }`}
          >
            <div
              className={`p-2 rounded-full relative flex items-center justify-center ${
                isActive
                  ? "bg-gradient-to-br from-yellow-400 to-green-500 text-black shadow-md"
                  : "text-gray-600"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "text-black" : "text-gray-500"}`} />

              {/* 🔴 Badge */}
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold rounded-full px-[6px] py-[1px] min-w-[18px] h-[18px] flex items-center justify-center shadow-md z-[1000]">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </div>

            <span
              className={`text-[12px] mt-1 font-medium ${
                isActive ? "text-gray-900 font-semibold" : "text-gray-500"
              }`}
            >
              {t(label as never)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎬 Fade Animation (once globally)                                          */
/* -------------------------------------------------------------------------- */
if (typeof window !== "undefined" && !document.getElementById("fadein-style")) {
  const style = document.createElement("style");
  style.id = "fadein-style";
  style.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn 0.25s ease-in-out; }
  `;
  document.head.appendChild(style);
}
