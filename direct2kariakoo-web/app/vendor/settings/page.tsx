"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LogOut,
  User,
  Package,
  Bell,
  Settings,
  Star,
  Wallet,
} from "lucide-react";
import VendorHeader from "../dashboard/components/VendorHeader";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

/* -------------------------------------------------------------------------- */
/* 🌟 Vendor Settings Page — Persistent Cache + Background Refresh            */
/* -------------------------------------------------------------------------- */
export default function VendorSettingsPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const CACHE_KEY = "vendor_settings_cache";
  const CACHE_TIME_KEY = `${CACHE_KEY}_time`;
  const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  /* -------------------------------------------------------------------------- */
  /* ⚡ Load Cached Vendor Instantly + Silent Refresh                           */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const now = Date.now();
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);

    if (cached && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY_MS) {
      try {
        setVendor(JSON.parse(cached));
        setLoading(false);
      } catch {}
    }

    fetchVendor(false);
    const interval = setInterval(() => fetchVendor(false), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 📡 Fetch Vendor (with optional shimmer)                                   */
  /* -------------------------------------------------------------------------- */
  async function fetchVendor(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/");
        return;
      }

      const storedVendor = localStorage.getItem("vendor");
      if (storedVendor) {
        const parsed = JSON.parse(storedVendor);
        setVendor(parsed);
        localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } else {
        const res = await api.get("/me");
        const data = res.data.user?.vendor || res.data.vendor || res.data;
        if (data) {
          setVendor(data);
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        }
      }
    } catch (err) {
      console.error("❌ Failed to fetch vendor:", err);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 🚪 Logout Handler                                                         */
  /* -------------------------------------------------------------------------- */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await api.post("/logout").catch(() => {});
    } finally {
      ["vendor", "token", CACHE_KEY, CACHE_TIME_KEY].forEach((k) =>
        localStorage.removeItem(k)
      );
      alert("You have been logged out!");
      router.push("/");
    }
  };

  /* -------------------------------------------------------------------------- */
  /* ✨ Shimmer Loader                                                          */
  /* -------------------------------------------------------------------------- */
  const SettingsShimmer = () => (
    <div className="animate-pulse max-w-2xl mx-auto px-5 py-8">
      <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-white border border-gray-100 rounded-xl mb-3 shadow-sm"
        />
      ))}
      <div className="h-12 bg-yellow-200 rounded-xl mt-6" />
    </div>
  );

  /* -------------------------------------------------------------------------- */
  /* 🧱 Render Page                                                            */
  /* -------------------------------------------------------------------------- */
  if (loading)
    return (
      <main className="min-h-screen bg-[#F9FAFB] font-poppins">
        <VendorHeader vendor={vendor} />
        <SettingsShimmer />
      </main>
    );

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-24 font-poppins animate-fadeIn">
      <VendorHeader vendor={vendor} />

      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* ==================== ACCOUNT SECTION ==================== */}
        <Section title="Account">
          <Tile icon={User} title="My Profile" href="/vendor/settings/profile" />
          <Tile icon={Package} title="My Products" href="/vendor/dashboard/products" />
          <Tile icon={Star} title="My Subscription" href="/vendor/settings/subscription" />
          <Tile icon={Wallet} title="My Wallet" href="/vendor/settings/wallet" />
        </Section>

        {/* ==================== NOTIFICATIONS & APP ==================== */}
        <Section title="Notifications & App">
          <Tile icon={Bell} title="Push Notifications" href="/vendor/settings/notifications" />
          <Tile
            icon={Settings}
            title="App Preferences"
            onClick={() =>
              alert("Coming soon — App Preferences under development.")
            }
          />
        </Section>

        {/* ==================== LOGOUT BUTTON ==================== */}
        <button
          onClick={() => setShowDialog(true)}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-xl py-3 mt-8 transition flex items-center justify-center gap-2 shadow-sm"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>

      {/* ==================== LOGOUT CONFIRMATION DIALOG ==================== */}
      {showDialog && (
        <LogoutDialog
          loading={loggingOut}
          onClose={() => setShowDialog(false)}
          onConfirm={handleLogout}
        />
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Section Component                                                       */
/* -------------------------------------------------------------------------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h3 className="text-xs text-[#0F766E] font-semibold mb-3 tracking-widest uppercase">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🧩 Tile Component                                                          */
/* -------------------------------------------------------------------------- */
function Tile({
  icon: Icon,
  title,
  href,
  onClick,
}: {
  icon: any;
  title: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      onClick={onClick}
      className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 hover:bg-gray-50 active:scale-[0.99] transition cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="bg-yellow-100 p-2.5 rounded-full">
          <Icon className="w-5 h-5 text-yellow-600" />
        </div>
        <span className="font-medium text-gray-800 text-[15px]">{title}</span>
      </div>
      <span className="text-gray-400 text-lg font-bold leading-none">›</span>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

/* -------------------------------------------------------------------------- */
/* 🚪 Logout Dialog                                                           */
/* -------------------------------------------------------------------------- */
function LogoutDialog({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl text-center animate-fadeIn">
        <h2 className="text-lg font-semibold mb-6 text-gray-900 font-poppins">
          Are you sure you want to logout?
        </h2>

        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg py-3 mb-3 transition disabled:opacity-60"
        >
          {loading ? "Logging out..." : "Logout"}
        </button>

        <button
          onClick={onClose}
          className="w-full border border-gray-300 rounded-lg py-3 hover:bg-gray-50 transition font-semibold text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎬 Fade Animation (Global once)                                            */
/* -------------------------------------------------------------------------- */
if (typeof window !== "undefined" && !document.getElementById("fadein-style")) {
  const style = document.createElement("style");
  style.id = "fadein-style";
  style.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn .3s ease-in-out; }
  `;
  document.head.appendChild(style);
}
