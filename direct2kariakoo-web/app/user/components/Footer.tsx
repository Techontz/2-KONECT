"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Image from "next/image";
import { Facebook, Instagram, Linkedin, X, Info, Mail } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* 🧠 Interfaces                                                              */
/* -------------------------------------------------------------------------- */
interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
}

/* -------------------------------------------------------------------------- */
/* 💾 Cache Configuration                                                     */
/* -------------------------------------------------------------------------- */
const memoryCache: {
  categories?: Category[];
  subcategoriesMap?: Record<number, Subcategory[]>;
  timestamp?: number;
} = {};

const CACHE_KEY = "d2k_footer_cache";
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

/* -------------------------------------------------------------------------- */
/* 🌍 Main Footer Component                                                   */
/* -------------------------------------------------------------------------- */
export default function Footer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState<Record<number, Subcategory[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = Date.now();

    // ✅ 1️⃣ Try memory cache
    if (
      memoryCache.categories &&
      memoryCache.subcategoriesMap &&
      memoryCache.timestamp &&
      now - memoryCache.timestamp < CACHE_TTL
    ) {
      setCategories(memoryCache.categories);
      setSubcategoriesMap(memoryCache.subcategoriesMap);
      setLoading(false);
      return;
    }

    // ✅ 2️⃣ Try localStorage cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < CACHE_TTL) {
          setCategories(parsed.categories || []);
          setSubcategoriesMap(parsed.subcategoriesMap || {});
          setLoading(false);
          return;
        }
      } catch {
        console.warn("⚠️ Failed to parse cached footer data");
      }
    }

    // ✅ 3️⃣ Fetch fresh data if not cached
    const fetchData = async () => {
      try {
        const catRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/categories`);
        const cats = Array.isArray(catRes.data) ? catRes.data : [];
        setCategories(cats);

        // Parallel fetch subcategories for each category
        const subResults = await Promise.all(
          cats.map(async (cat) => {
            try {
              const subRes = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/categories/${cat.id}/subcategories`
              );
              return [cat.id, Array.isArray(subRes.data) ? subRes.data : []];
            } catch {
              return [cat.id, []];
            }
          })
        );

        const map: Record<number, Subcategory[]> = {};
        subResults.forEach(([id, subs]) => (map[id as number] = subs as Subcategory[]));

        // ✅ Save in both caches
        memoryCache.categories = cats;
        memoryCache.subcategoriesMap = map;
        memoryCache.timestamp = now;

        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ categories: cats, subcategoriesMap: map, timestamp: now })
        );
      } catch (err) {
        console.error("❌ Footer fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* -------------------------------------------------------------------------- */
  /* 💅 Render                                                                 */
  /* -------------------------------------------------------------------------- */
  return (
    <footer className="bg-white text-gray-700 border-t border-gray-200">
      {/* ==================== HELP SECTION ==================== */}
      <div className="bg-[#F6F7FB] px-6 md:px-16 lg:px-24 py-8 border-b border-gray-200 text-center md:text-left">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">We&apos;re Always Here To Help</h3>
        <p className="text-sm text-gray-500 mb-6">
          Reach out to us through any of these support channels
        </p>

        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center md:justify-start gap-6 sm:gap-10">
          {/* Help Center */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start w-10 h-10 rounded-full border border-gray-300 text-gray-600 mx-auto sm:mx-0">
              <Info size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mt-2 sm:mt-0">
                HELP CENTER
              </p>
              <a
                href="mailto:help@direct2kariakoo.com"
                className="text-sm text-gray-800 font-medium hover:underline"
              >
                help.direct2kariakoo.com
              </a>
            </div>
          </div>

          {/* Email Support */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start w-10 h-10 rounded-full border border-gray-300 text-gray-600 mx-auto sm:mx-0">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mt-2 sm:mt-0">
                EMAIL SUPPORT
              </p>
              <a
                href="mailto:care@direct2kariakoo.com"
                className="text-sm text-gray-800 font-medium hover:underline"
              >
                care@direct2kariakoo.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== CATEGORY GRID ==================== */}
      <div className="px-6 md:px-16 lg:px-24 py-10 bg-white">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <div className="h-4 w-1/2 bg-gray-200 rounded mb-3 animate-pulse" />
                {[...Array(5)].map((__, j) => (
                  <div
                    key={j}
                    className="h-3 w-3/4 bg-gray-100 rounded mb-2 animate-pulse"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 text-sm">
            {categories.slice(0, 6).map((cat) => (
              <FooterColumn
                key={cat.id}
                title={cat.name}
                links={subcategoriesMap[cat.id] || []}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center">No categories available</p>
        )}
      </div>

      {/* ==================== APP DOWNLOAD + SOCIAL ==================== */}
      <div className="px-6 md:px-16 lg:px-24 py-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-8 bg-white">
        {/* 🎯 App Section */}
        <div className="text-center md:text-left">
          <h4 className="font-semibold text-gray-800 mb-4 uppercase tracking-wide">
            Shop On The Go
          </h4>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <Image src="/badges/appstore.png" alt="App Store" width={110} height={38} className="object-contain" />
            <Image src="/badges/playstore.png" alt="Google Play" width={110} height={38} className="object-contain" />
            <Image src="/badges/appgallery.png" alt="App Gallery" width={110} height={38} className="object-contain" />
          </div>
        </div>

        {/* 🎯 Social Section */}
        <div className="text-center md:text-right">
          <h4 className="font-semibold text-gray-800 mb-4 uppercase tracking-wide">
            Connect With Us
          </h4>
          <div className="flex items-center justify-center md:justify-end gap-3 sm:gap-4">
            {[Facebook, X, Instagram, Linkedin].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-yellow-400 text-black rounded-full hover:opacity-80 transition"
              >
                <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== COPYRIGHT ==================== */}
      <div className="bg-gray-100 text-center py-6 text-xs sm:text-sm text-gray-600 border-t flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 pb-24 md:pb-8">
        <p>© 2025 Direct2Kariakoo. All Rights Reserved.</p>

        <div className="flex items-center flex-wrap justify-center gap-3 md:gap-4">
          <Image src="/payments/mpesa.png" alt="M-Pesa" width={40} height={20} className="object-contain" />
          <Image src="/payments/mixx.png" alt="Mixx by YAS" width={40} height={20} className="object-contain" />
          <Image src="/payments/mastercard.png" alt="Mastercard" width={40} height={20} className="object-contain" />
          <Image src="/payments/visa.png" alt="Visa" width={40} height={20} className="object-contain" />
          <Image src="/payments/amex.png" alt="Amex" width={40} height={20} className="object-contain" />
          <Image src="/payments/cash.png" alt="Cash" width={40} height={20} className="object-contain" />
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-gray-500 text-[13px]">
          <a href="#" className="hover:text-gray-800">Careers</a>
          <a href="#" className="hover:text-gray-800">Warranty Policy</a>
          <a href="#" className="hover:text-gray-800">Sell with us</a>
          <a href="#" className="hover:text-gray-800">Terms of Use</a>
          <a href="#" className="hover:text-gray-800">Terms of Sale</a>
          <a href="#" className="hover:text-gray-800">Privacy Policy</a>
          <a href="#" className="hover:text-gray-800">Consumer Rights</a>
        </div>

        <p className="text-gray-500 text-[13px]">
          Developed by <span className="font-semibold text-gray-800">TechOn Software Co.</span>
        </p>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* 📦 Footer Column Component                                                 */
/* -------------------------------------------------------------------------- */
function FooterColumn({ title, links }: { title: string; links: Subcategory[] }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-800 mb-3 text-sm">{title}</h4>
      <ul className="space-y-1">
        {links.length > 0 ? (
          links.map((link) => (
            <li
              key={link.id}
              className="text-gray-600 hover:text-gray-900 cursor-pointer text-sm transition"
              onClick={() => (window.location.href = `/user/subcategories?id=${link.id}`)}
            >
              {link.name}
            </li>
          ))
        ) : (
          <li className="text-gray-400 text-sm italic">No items</li>
        )}
      </ul>
    </div>
  );
}
