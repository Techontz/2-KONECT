"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LogOut,
  ShoppingCart,
  Heart,
  Bell,
  User,
  MapPin,
  HelpCircle,
  Shield,
  FileText,
  Headphones,
  UserCircle2,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: string;
  photo_url?: string;
  vendor?: any;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const CACHE_KEY_USER = "d2k_user_profile";
  const CACHE_KEY_CART = "d2k_cart_count";
  const CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours

  // ✅ Fetch from /me + /cart with cache
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    const now = Date.now();
    const cachedUser = localStorage.getItem(CACHE_KEY_USER);
    const cachedCart = localStorage.getItem(CACHE_KEY_CART);
    const cachedTime = localStorage.getItem(`${CACHE_KEY_USER}_time`);

    // ✅ Load cached data instantly
    if (cachedUser && cachedTime && now - parseInt(cachedTime) < CACHE_EXPIRY_MS) {
      setUser(JSON.parse(cachedUser));
      setCartCount(parseInt(cachedCart || "0"));
      setLoading(false);
    }

    // ✅ Refresh in background (non-blocking)
    const fetchData = async () => {
      try {
        const [userRes, cartRes] = await Promise.all([
          api.get("/me"),
          api.get("/cart"),
        ]);

        const fetchedUser = userRes.data;
        const fetchedCart = cartRes.data.items?.length || 0;

        setUser(fetchedUser);
        setCartCount(fetchedCart);

        // Save cache
        localStorage.setItem(CACHE_KEY_USER, JSON.stringify(fetchedUser));
        localStorage.setItem(CACHE_KEY_CART, fetchedCart.toString());
        localStorage.setItem(`${CACHE_KEY_USER}_time`, now.toString());
      } catch (err: any) {
        console.error("❌ Profile fetch failed:", err);
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          router.push("/");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // ✅ Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post("/logout");
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem(CACHE_KEY_USER);
    localStorage.removeItem(CACHE_KEY_CART);
    setTimeout(() => {
      setLoggingOut(false);
      router.push("/");
    }, 800);
  };

  // ✅ UI
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* ===== HEADER ===== */}
      <div className="pt-12 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar with fallback */}
          {user?.photo_url ? (
            <Image
              src={user.photo_url}
              alt="avatar"
              width={70}
              height={70}
              className="rounded-full border-2 border-gray-200 object-cover shadow-sm"
            />
          ) : (
            <div className="w-[70px] h-[70px] rounded-full border-2 border-gray-200 flex items-center justify-center bg-gray-100">
              <UserCircle2 className="text-gray-400 w-12 h-12" />
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {user?.name || "Guest User"}
            </h2>
            <p className="text-sm text-gray-600">{user?.email}</p>
            {user?.phone && (
              <p className="text-sm text-gray-500">📞 {user.phone}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push("/user/profile/edit")}
          className="border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm px-4 py-1.5 rounded-lg font-medium"
        >
          Edit
        </button>
      </div>

      {/* ===== ACCOUNT SECTION ===== */}
      <SectionTitle title="ACCOUNT" />
      <SettingsSection
        items={[
          {
            icon: <ShoppingCart className="w-5 h-5" />,
            label: "My Cart",
            badge: cartCount,
          },
          { icon: <Heart className="w-5 h-5" />, label: "Wishlist" },
          { icon: <Bell className="w-5 h-5" />, label: "Notifications" },
          { icon: <User className="w-5 h-5" />, label: "Account Details" },
          { icon: <MapPin className="w-5 h-5" />, label: "Saved Addresses" },
          {
            icon: <LogOut className="w-5 h-5 text-red-600" />,
            label: "Logout",
            danger: true,
          },
        ]}
        onItemClick={(label) => {
          if (label === "Logout") setShowLogoutConfirm(true);
          else if (label === "My Cart") router.push("/user/cart");
        }}
      />

      {/* ===== SUPPORT SECTION ===== */}
      <SectionTitle title="SUPPORT" />
      <SettingsSection
        items={[
          { icon: <Headphones className="w-5 h-5" />, label: "Contact Support" },
          { icon: <HelpCircle className="w-5 h-5" />, label: "Help Center" },
          { icon: <Shield className="w-5 h-5" />, label: "Privacy Policy" },
          { icon: <FileText className="w-5 h-5" />, label: "Terms of Service" },
        ]}
      />

      {/* ===== Logout Modal ===== */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
              Log Out
            </h3>
            <p className="text-gray-600 text-sm text-center mb-5">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                disabled={loggingOut}
                onClick={() => setShowLogoutConfirm(false)}
                className="px-5 py-2 rounded-lg border text-gray-700 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={loggingOut}
                onClick={handleLogout}
                className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium flex items-center gap-2 disabled:opacity-70"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  "Log Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Helper Components ---------- */
function SectionTitle({ title }: { title: string }) {
  return (
    <div className="px-6 mt-8 mb-3">
      <h3 className="text-xs font-bold text-gray-700 tracking-[0.15em] uppercase">
        {title}
      </h3>
    </div>
  );
}

type SettingsItem = {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  danger?: boolean;
};

function SettingsSection({
  items,
  onItemClick,
}: {
  items: SettingsItem[];
  onItemClick?: (label: string) => void;
}) {
  return (
    <div className="bg-white mx-4 rounded-xl border border-gray-200 shadow-sm">
      {items.map((item, idx) => (
        <div key={idx}>
          <button
            onClick={() => onItemClick?.(item.label)}
            className={`w-full flex items-center justify-between py-3.5 px-5 text-left ${
              item.danger ? "text-red-600" : "text-gray-800"
            } hover:bg-gray-50 transition`}
          >
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 rounded-full p-2.5">{item.icon}</div>
              <span className="font-medium text-[15px]">{item.label}</span>
            </div>
            {item.badge && item.badge > 0 && (
              <span className="bg-yellow-400 text-black text-xs font-bold rounded-full px-2.5 py-0.5">
                {item.badge}
              </span>
            )}
          </button>
          {idx < items.length - 1 && (
            <div className="ml-16 border-t border-gray-100"></div>
          )}
        </div>
      ))}
    </div>
  );
}
