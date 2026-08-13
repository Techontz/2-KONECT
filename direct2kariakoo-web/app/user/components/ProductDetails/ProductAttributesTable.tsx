"use client";
import DottedDivider from "@/app/user/components/ProductDetails/DottedDivider";

export default function ProductAttributesTable({
  attributes,
}: {
  attributes?: any[];
}) {
  if (!attributes || attributes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-lg">
        Product Details
      </h3>

      {attributes.map((attr, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm py-2">
            <span className="text-gray-600">{attr.attribute?.name}</span>
            <span className="font-medium text-gray-900">{attr.value}</span>
          </div>
          {i < attributes.length - 1 && <DottedDivider />}
        </div>
      ))}
    </div>
  );
}
