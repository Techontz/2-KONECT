"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import axios from "axios";
import Header from "@/app/user/components/Header";
import ProductImages from "./ProductImages";
import ProductInfo from "./ProductInfo";
import ProductDescription from "./ProductDescription";
import ProductAttributesTable from "./ProductAttributesTable";
import ProductBottomBar from "./ProductBottomBar";
import ProductReviewsSection from "./ProductReviewsSection";
import VendorInfo from "./VendorInfo";
import ProductPriceRow from "./ProductPriceRow";
import ProductGrid from "../ProductGrid";

/* -------------------------------------------------------------------------- */
/* 💫 Skeleton shimmer loader                                                */
/* -------------------------------------------------------------------------- */
function ProductDetailsSkeleton() {
  return (
    <div className="animate-pulse bg-gray-50 min-h-screen px-6 py-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-200 h-96 w-full rounded-lg" />
        <div className="flex flex-col gap-4">
          <div className="h-6 w-3/4 bg-gray-200 rounded" />
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
          <div className="h-5 w-2/3 bg-gray-200 rounded" />
          <div className="h-5 w-1/3 bg-gray-200 rounded" />
          <div className="h-40 w-full bg-gray-100 rounded-lg mt-6" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🧩 Main Component                                                         */
/* -------------------------------------------------------------------------- */
export default function ProductDetails({ product }: { product: any }) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /* Detect device width */
  useEffect(() => {
    const updateLayout = () => setIsDesktop(window.innerWidth >= 1024);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  /* Simulate fade-in after mount */
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timer);
  }, [product]);

  /* Back navigation */
  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/user");
  };

  /* Fetch related products */
  useEffect(() => {
    if (!product?.subcategory?.id) return;

    const fetchRelated = async () => {
      try {
        setLoadingRelated(true);
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/subcategories/${product.subcategory.id}/products`
        );
        const all = Array.isArray(res.data.products)
          ? res.data.products.filter((p: any) => p.id !== product.id)
          : [];
        setRelatedProducts(all);
      } catch (err) {
        console.error("❌ Failed to load related products:", err);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelated();
  }, [product]);

  if (!product) return <ProductDetailsSkeleton />;

  return (
    <div
      className={`bg-gray-50 min-h-screen relative transition-opacity duration-300 ${
        isLoading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Header (desktop only) */}
      {isDesktop && (
        <Header
          onCategorySelect={() => {}} // prevent any auto redirect
          onSubcategorySelect={() => {}} // disable subcategory redirects here
        />
      )}

      {/* Mobile top bar */}
      {!isDesktop && (
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-3 shadow-sm">
          <button
            onClick={handleBack}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition"
          >
            <ArrowLeft size={22} className="text-teal-600" />
          </button>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Product Details
          </h1>
          <div className="w-8" />
        </div>
      )}

      {/* Main layout */}
      <div className="max-w-7xl mx-auto py-8 px-4 lg:px-6 pb-28">
        {isDesktop ? (
          <div className="grid grid-cols-2 gap-6">
            <ProductImages images={product.images || []} />
            <div className="flex flex-col gap-6">
              <ProductInfo product={product} />
              <ProductPriceRow product={product} />
              <VendorInfo vendor={product.vendor} />
              <ProductDescription description={product.description} />
              <ProductAttributesTable attributes={product.attribute_values} />
              <ProductReviewsSection productId={product.id} />
            </div>
          </div>
        ) : (
          <div>
            <ProductImages images={product.images || []} />
            <div className="px-4 space-y-5 mt-3">
              <ProductInfo product={product} />
              <ProductPriceRow product={product} />
              <VendorInfo vendor={product.vendor} />
              <ProductDescription description={product.description} />
              <ProductAttributesTable attributes={product.attribute_values} />
              <ProductReviewsSection productId={product.id} />
            </div>
          </div>
        )}

        {/* Related Products */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            More from {product.subcategory?.name || "this subcategory"}
          </h2>

          {loadingRelated ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-200 h-60 rounded-lg shadow-sm"
                ></div>
              ))}
            </div>
          ) : relatedProducts.length > 0 ? (
            <ProductGrid products={relatedProducts} />
          ) : (
            <p className="text-gray-400 text-sm">
              No other products found in this subcategory.
            </p>
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 z-50">
        <ProductBottomBar price={product.new_price} productId={product.id} />
      </div>
    </div>
  );
}
