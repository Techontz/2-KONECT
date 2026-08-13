"use client";

export default function ProductPriceRow({ product }: { product: any }) {
  // ✅ Safely convert to numbers
  const newPrice = Number(product.new_price || 0);
  const oldPrice = Number(product.old_price || 0);

  // ✅ Calculate discount percentage
  const discount =
    oldPrice && oldPrice > newPrice
      ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
      : 0;

  // ✅ Format helper for prices (adds commas)
  const formatTZS = (amount: number) =>
    amount.toLocaleString("en-TZ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 font-semibold">TZS</span>
        <h2 className="text-2xl font-bold text-gray-900">
          {formatTZS(newPrice)}
        </h2>

        {discount > 0 && (
          <span className="bg-yellow-300 text-gray-800 text-xs font-bold px-2 py-1 rounded">
            -{discount}%
          </span>
        )}
      </div>

      {oldPrice > 0 && (
        <p className="text-sm text-gray-400 line-through mt-1">
          TZS {formatTZS(oldPrice)}
        </p>
      )}

      {product.stock && (
        <p className="mt-2 text-[13px] text-teal-600 font-medium">
          Only {product.stock} left in stock
        </p>
      )}
    </div>
  );
}
