"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

const brandColor = "#0F766E";

export default function VendorSubscriptionPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function startPayment(plan: string) {
    const provider = prompt("Enter provider (Airtel, Tigo, Mpesa, etc):", "Mpesa");
    const msisdn = prompt("Enter phone (07xxxxxxxx or 2557xxxxxxxx):");
    if (!provider || !msisdn) return alert("Cancelled.");

    try {
      setLoading(true);
      const res = await api.post("/vendor/subscription/checkout", {
        plan,
        provider,
        msisdn,
      });
      alert("Approve payment on your phone...");
      console.log(res.data);
    } catch (err) {
      alert("Payment failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-24 font-poppins">
      {/* Header */}
      <header className="bg-white shadow-sm px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        {/* Back Arrow */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-700 hover:text-black transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline text-sm font-medium">Back</span>
        </button>

        <h1 className="font-semibold text-gray-800 text-lg text-center flex-1">
          💼 Subscriptions
        </h1>

        {/* Spacer to balance layout */}
        <div className="w-8 sm:w-10" />
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center">
          Choose Your Plan
        </h2>

        <PlanCard
          title="Basic Plan"
          price="TZS 5,000"
          features={["10 Product Listings", "Basic Analytics", "Limited Support"]}
          onSelect={() => startPayment("basic")}
        />

        <PlanCard
          title="Pro Plan"
          price="TZS 10,000"
          features={["Unlimited Listings", "Advanced Analytics", "Priority Support"]}
          highlight
          onSelect={() => startPayment("pro")}
        />

        <PlanCard
          title="Enterprise"
          price="TZS 20,000"
          features={["Custom Integrations", "Dedicated Manager", "API Access"]}
          onSelect={() => startPayment("enterprise")}
        />
      </div>
    </main>
  );
}

/* --------------------------- PLAN CARD COMPONENT --------------------------- */
function PlanCard({
  title,
  price,
  features,
  highlight,
  onSelect,
}: {
  title: string;
  price: string;
  features: string[];
  highlight?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm mb-6 border ${
        highlight ? "border-teal-600" : "border-gray-100"
      }`}
    >
      {highlight && (
        <div className="bg-teal-50 text-center text-teal-700 py-2 font-semibold text-sm rounded-t-2xl">
          ⭐ Most Popular
        </div>
      )}

      <div className="p-6">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="text-2xl font-semibold text-teal-700 mt-1">{price}</p>

        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-teal-600">✔️</span> {f}
            </li>
          ))}
        </ul>

        <button
          onClick={onSelect}
          disabled={false}
          className={`mt-6 w-full bg-[${brandColor}] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0d6e64] transition disabled:opacity-50`}
        >
          Choose Plan
        </button>
      </div>
    </div>
  );
}
