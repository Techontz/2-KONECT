"use client";

import { Phone, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function VendorInfo({ vendor }: { vendor: any }) {
  const router = useRouter();

  if (!vendor) return null;

  // 🧠 Debug log for verifying correct vendor data
  console.log("🧩 VendorInfo Loaded:", {
    vendor_table_id: vendor.id,
    vendor_user_id: vendor.user_id,
    business_name: vendor.business_name,
    phone: vendor.phone,
    logo: vendor.logo,
  });

  // ✅ Base URL for storage
  const baseUrl =
    process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, "") || "";

  // ✅ Get full logo path
  const getLogo = () => {
    if (!vendor.logo) return "/images/placeholder.png"; // fallback must exist in /public/images/
    if (vendor.logo.startsWith("http")) return vendor.logo;
    if (vendor.logo.startsWith("/")) return `${baseUrl}${vendor.logo}`;
    return `${baseUrl}/${vendor.logo}`;
  };

  // ✅ Handle Chat Navigation
  const handleChat = () => {
    console.log(
      `🚀 Opening chat with ${vendor.business_name} | vendor.user_id = ${vendor.user_id}`
    );

    if (!vendor.user_id) {
      alert(
        "⚠️ Chat unavailable. Missing vendor.user_id from backend response. Please check API to include user_id."
      );
      return;
    }

    // Pass vendor logo to chat
    const vendorLogo = encodeURIComponent(getLogo());

    router.push(
      `/user/chat?vendorId=${vendor.user_id}&vendorName=${encodeURIComponent(
        vendor.business_name || "Vendor"
      )}&vendorLogo=${vendorLogo}`
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
      {/* Vendor Info Section */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12">
          <img
            src={getLogo()}
            alt={vendor.business_name || "Vendor"}
            className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm transition-all duration-300 hover:scale-105"
          />
          {/* ✅ Optional green active indicator */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
        </div>

        <div>
          <p className="font-semibold text-gray-900 leading-tight">
            {vendor.business_name || "Vendor Name"}
          </p>
          <p className="text-xs text-gray-500">Trusted Seller ✅</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {vendor.phone && (
          <a
            href={`tel:${vendor.phone}`}
            className="flex items-center gap-1 bg-teal-50 text-teal-700 px-3 py-1 rounded-full border border-teal-100 text-sm hover:bg-teal-100 transition-all"
          >
            <Phone size={14} /> Call
          </a>
        )}

        <button
          onClick={handleChat}
          className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200 text-sm hover:bg-gray-200 transition-all"
        >
          <MessageCircle size={14} /> Chat
        </button>
      </div>
    </div>
  );
}
