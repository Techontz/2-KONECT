"use client";

import { useRouter } from "next/navigation";

export default function CartSummary({
  subtotal,
  totalItems,
}: {
  subtotal: number;
  totalItems: number;
}) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 sticky top-10">
      <h3 className="text-lg font-semibold mb-3">Summary</h3>
      <div className="flex justify-between mb-2 text-sm text-gray-600">
        <span>Items:</span>
        <span>{totalItems}</span>
      </div>
      <div className="flex justify-between text-lg font-semibold text-black mt-2">
        <span>Estimated Total:</span>
        <span>TZS {subtotal.toLocaleString()}</span>
      </div>

      <button
        onClick={() => router.push(`/user/checkout?total=${subtotal}`)}
        disabled={!totalItems}
        className={`mt-6 w-full py-3 rounded-md font-semibold ${
          totalItems
            ? "bg-yellow-400 hover:bg-yellow-300 text-black"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        Checkout ({totalItems})
      </button>

      <div className="mt-5 border-t pt-3">
        <p className="text-sm text-gray-500">
          <strong>Pay with:</strong> Visa, MasterCard, M-Pesa, Airtel Money, or HaloPesa
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Buyer protection: Full refund if item not delivered or not as described.
        </p>
      </div>
    </div>
  );
}
