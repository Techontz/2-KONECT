"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import VendorHeader from "../../dashboard/components/VendorHeader";

export default function VendorWalletPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /* ---------------------------- LOAD VENDOR INFO ---------------------------- */
  useEffect(() => {
    const storedVendor = localStorage.getItem("vendor");
    if (storedVendor) {
      setVendor(JSON.parse(storedVendor));
    }
  }, []);

  /* ---------------------------- FETCH WALLET DATA ---------------------------- */
  useEffect(() => {
    async function fetchWallet() {
      try {
        const res = await api.get("/vendor/wallet");
        setWallet(res.data);
      } catch (err) {
        console.error("❌ Failed to load wallet:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchWallet();
  }, []);

  /* ---------------------------- RENDER ---------------------------- */
  return (
    <main className="min-h-screen bg-[#F1F5F9] font-poppins">
      {/* Header */}
      <VendorHeader vendor={vendor} />

      {/* Back Arrow */}
      <div className="max-w-2xl mx-auto px-5 mt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-700 hover:text-black transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="bg-teal-100 p-4 rounded-full mb-4">
              <Wallet className="w-8 h-8 text-teal-700" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              My Wallet
            </h2>

            {loading ? (
              <p className="text-gray-500">Loading wallet...</p>
            ) : wallet ? (
              <>
                <p className="text-4xl font-bold text-teal-700 mb-1">
                  TZS {Number(wallet.balance || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Available Balance
                </p>

                <div className="flex gap-4">
                  <button className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium transition">
                    <CreditCard className="w-5 h-5" />
                    Deposit
                  </button>

                  <button className="flex items-center justify-center gap-2 border border-teal-600 text-teal-700 px-5 py-2.5 rounded-lg font-medium hover:bg-teal-50 transition">
                    Withdraw
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-500">No wallet data available.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
