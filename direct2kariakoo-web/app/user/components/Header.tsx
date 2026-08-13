"use client";

import { useRef } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  ShoppingCart,
  Package,
  MessageSquare,
  User,
  Menu,
  X,
} from "lucide-react";
import SearchBar from "./SearchBar";
import CategoryNav from "./CategoryNav";
import axios from "axios";
import { listenEvent } from "@/lib/eventBus";

interface Category {
  id: number;
  name: string;
  subcategories?: { id: number; name: string }[];
}

interface LocationData {
  city: string;
  country: string;
  countryCode: string;
}

interface HeaderProps {
  onCategorySelect?: (category: Category) => void;
  onSubcategorySelect?: (subcategoryId: number) => void;
}

// ✅ Cache keys
const CAT_CACHE_KEY = "d2k_categories_cache";
const CAT_CACHE_TIME = "d2k_categories_cache_time";
const CAT_CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours

export default function Header({
  onCategorySelect,
  onSubcategorySelect,
}: HeaderProps) {
  const hasInitializedCategory = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [location, setLocation] = useState<LocationData>({
    city: "Dar es Salaam",
    country: "Tanzania",
    countryCode: "tz",
  });
  const [loadingLocation, setLoadingLocation] = useState(true);

  useEffect(() => {
    if (categories.length === 0) return;
  
    // 🔒 Prevent re-initialization on background refresh
    if (hasInitializedCategory.current) return;
  
    hasInitializedCategory.current = true;
  
    const savedCatId = localStorage.getItem("active_category");
  
    // ✅ Restore saved category
    if (savedCatId) {
      const found = categories.find(
        (c) => c.id === Number(savedCatId)
      );
  
      if (found) {
        setSelectedCategory(found);
        setActiveCategory(found);
        onCategorySelect?.(found);
        return;
      }
    }
  
    // ✅ First visit → select first category ONCE
    const first = categories[0];
    if (first) {
      setSelectedCategory(first);
      setActiveCategory(first);
      localStorage.setItem("active_category", String(first.id));
      onCategorySelect?.(first);
    }
  }, [categories]);
  
  /* ------------------------- 📍 Location Fetch ----------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) {
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
          );
          const data = await res.json();
          if (data.results?.length > 0) {
            const comp = data.results[0].address_components;
            const cityObj =
              comp.find((c: any) => c.types.includes("locality")) ||
              comp.find((c: any) =>
                c.types.includes("administrative_area_level_1")
              );
            const countryObj = comp.find((c: any) =>
              c.types.includes("country")
            );
            const city = cityObj?.long_name || "Unknown City";
            const country = countryObj?.long_name || "Unknown Country";
            const code = countryObj?.short_name?.toLowerCase() || "tz";
            setLocation({ city, country, countryCode: code });
          }
        } catch {
          console.warn("Location fetch failed");
        } finally {
          setLoadingLocation(false);
        }
      },
      () => setLoadingLocation(false),
      { enableHighAccuracy: true }
    );
  }, []);

  /* -------------------------- 🗂️ Fetch Categories -------------------------- */
  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      try {
        const cached = localStorage.getItem(CAT_CACHE_KEY);
        const cachedTime = localStorage.getItem(CAT_CACHE_TIME);
        const now = Date.now();

        // ✅ Load from cache immediately
        if (cached && cachedTime && now - parseInt(cachedTime) < CAT_CACHE_EXPIRY) {
          const parsed = JSON.parse(cached);
          if (!cancelled) {
            setCategories(parsed);
            setLoadingCats(false);
          }
        }

        // ✅ Background refresh
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/categories-with-subcategories`
        );
        const cats = Array.isArray(res.data) ? res.data : [];

        if (!cancelled) {
          setCategories(cats);
          localStorage.setItem(CAT_CACHE_KEY, JSON.stringify(cats));
          localStorage.setItem(CAT_CACHE_TIME, now.toString());
          setLoadingCats(false);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        setLoadingCats(false);
      }
    };

    fetchCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------- 🛒 Fetch Counts & Live Sync ---------------------- */
  const updateCounts = async () => {
    // 🚫 Skip updates while user is navigating
    if (isNavigating) return;
  
    try {
      const token = localStorage.getItem("token");
      const userId = localStorage.getItem("userId");
      if (!token || !userId) return;
  
      const headers = { Authorization: `Bearer ${token}` };
  
      // ✅ Fetch all counts
      const [msgRes, orderRes, cartRes] = await Promise.allSettled([
        axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/messages/count-unread-messages/${userId}`,
          { headers }
        ),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/orders/count`, { headers }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/cart`, { headers }),
      ]);
  
      // ✅ Update message count
      if (msgRes.status === "fulfilled") {
        setUnreadCount(msgRes.value.data.count || 0);
      }
  
      // ✅ Update order count (store locally too)
      if (orderRes.status === "fulfilled") {
        const count = orderRes.value.data.count || 0;
        setOrderCount(count);
        localStorage.setItem("orders_count", String(count));
      }
  
      // ✅ Update cart count
      if (cartRes.status === "fulfilled") {
        const items =
          cartRes.value.data.items || cartRes.value.data.cart?.items || [];
        setCartCount(items.length || 0);
        localStorage.setItem("cart_items", JSON.stringify(items));
      }
    } catch (err) {
      console.error("Failed to update counts:", err);
    }
  };
  
  useEffect(() => {
    // 🚫 Skip updates on cart or checkout pages to prevent re-render navigation loop
    if (pathname?.includes("/user/cart") || pathname?.includes("/user/checkout")) {
      return;
    }
  
    const cachedCart = localStorage.getItem("cart_items");
    if (cachedCart) setCartCount(JSON.parse(cachedCart).length || 0);
  
    const cachedOrders = localStorage.getItem("orders_count");
    if (cachedOrders) setOrderCount(Number(cachedOrders));
  
    updateCounts();
  
    const offCart = listenEvent("cart-updated", updateCounts);
    const offOrders = listenEvent("orders-updated", updateCounts);
  
    const interval = setInterval(() => {
      if (!isNavigating) updateCounts();
    }, 20000);
  
    return () => {
      offCart();
      offOrders();
      clearInterval(interval);
    };
  }, [pathname]); // ✅ Stable dependency
  
  /* ----------------------------- 🧠 Render --------------------------------- */
  return (
    <header className="w-full sticky top-0 z-50 bg-white shadow-sm">
      {/* === Yellow Top Bar === */}
      <div className="bg-[#FFD100] px-3 md:px-10 py-3 flex items-center justify-between">
        {/* Left: Logo + Location */}
        <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
          <button onClick={() => setShowMenu(!showMenu)} className="md:hidden">
            {showMenu ? <X size={24} /> : <Menu size={24} />}
          </button>

          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logooo.png`}
            alt="Direct2Kariakoo"
            width={170}
            height={38}
            className="cursor-pointer"
            onClick={() => router.push("/user")}
          />

          {!loadingLocation && (
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-800 font-medium">
              <Image
                src={`https://flagcdn.com/24x18/${location.countryCode}.png`}
                alt={location.country}
                width={24}
                height={18}
              />
              <span>Deliver to</span>
              <span className="font-semibold">{location.city}</span>
            </div>
          )}
        </div>

        {/* === SearchBar === */}
        <div className="hidden md:flex justify-center flex-1 px-10">
          <div className="w-full max-w-[1000px]">
            <SearchBar />
          </div>
        </div>

        {/* === Right Icons === */}
        <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
          {/* Messages */}
          <button
            onClick={() => router.push("/user/messages")}
            className="relative text-gray-700 hover:text-gray-900"
          >
            <MessageSquare size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] rounded-full px-1.5 font-semibold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Orders */}
          <button
            onClick={() => router.push("/user/orders")}
            className="relative text-gray-700 hover:text-gray-900"
          >
            <Package size={22} />
            {orderCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-[10px] rounded-full px-1.5 font-semibold">
                {orderCount}
              </span>
            )}
          </button>

          {/* 🛒 Cart */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isNavigating) return;
              setIsNavigating(true);
              router.push("/user/cart");
              setTimeout(() => setIsNavigating(false), 1500); // allow navigation to settle
            }}
            className="relative text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-green-600 text-white text-[10px] rounded-full px-1.5 font-semibold">
                {cartCount}
              </span>
            )}
          </button>

          {/* Account */}
          <button
            onClick={() => router.push("/user/profile")}
            className="hidden md:flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <User size={20} />
            <span className="text-sm font-medium">Account</span>
          </button>
        </div>
      </div>

      {/* === Category Nav === */}
      <div className="bg-white border-t border-gray-200 shadow-sm min-h-[46px]">
      {loadingCats ? (
        <div className="flex gap-6 px-10 py-2 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 w-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      ) : (
        <CategoryNav
          categories={categories}
          activeCategory={activeCategory || selectedCategory}
          onHover={(cat) => {
            setActiveCategory(cat);
            setSelectedCategory(cat);
            localStorage.setItem("active_category", String(cat.id));
            onCategorySelect?.(cat);
          }}
          onLeave={() => setActiveCategory(selectedCategory)}
        />
      )}

      </div>

      {/* === Mobile Drawer === */}
      {showMenu && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-lg py-4 px-5 animate-fadeIn">
          <div className="mb-4">
            <SearchBar />
          </div>
          <div className="flex flex-col mt-2 space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat);
                  router.push(`/user/category?id=${cat.id}`);
                  setShowMenu(false);
                }}
                className={`text-left font-medium transition ${
                  selectedCategory?.id === cat.id
                    ? "text-black border-b border-black"
                    : "text-gray-700 hover:text-black"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.25s ease-in-out; }
      `}</style>
    </header>
  );
}
