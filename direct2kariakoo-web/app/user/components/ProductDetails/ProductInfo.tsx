export default function ProductInfo({ product }: { product: any }) {
  return (
    <div className="mb-3">
      <h1 className="text-2xl font-semibold text-gray-900 leading-tight">
        {product.name}
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        {product.category?.name || "General"} •{" "}
        {product.brand || "Brand not specified"}
      </p>
    </div>
  );
}
