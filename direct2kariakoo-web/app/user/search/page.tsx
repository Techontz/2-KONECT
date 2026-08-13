"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft, Search } from "lucide-react";
import ProductCard from "../components/ProductCard";

// ✅ Wrap component that uses useSearchParams in <Suspense>
function SearchPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQuery = params.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 🔍 Fetch products
  const fetchResults = async (q: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/search?q=${encodeURIComponent(q)}`
      );
      setProducts(res.data.products || []);
    } catch (err) {
      console.error("❌ Error fetching search results:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) fetchResults(initialQuery);
  }, [initialQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/user/search?q=${encodeURIComponent(query)}`);
    fetchResults(query);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 🔹 Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 transition"
          >
            <ArrowLeft size={22} className="text-gray-700" />
          </button>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="flex items-center flex-1 bg-gray-100 rounded-full px-3 py-2"
          >
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="flex-1 bg-transparent focus:outline-none text-sm text-gray-700 placeholder-gray-400"
            />
          </form>
        </div>
      </header>

      {/* 🔹 Results Section */}
      <main className="flex-1 px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-20 text-gray-500 animate-pulse">
            <Search size={40} className="mb-3 text-teal-500" />
            <p className="text-sm font-medium">Searching products...</p>
          </div>
        ) : !loading && searched && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
            <Search size={40} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs mt-1 text-gray-400">
              Try searching for something else
            </p>
          </div>
        ) : products.length > 0 ? (
          <>
            <h2 className="text-lg font-semibold mb-5 text-gray-800">
              {`Found ${products.length} ${products.length === 1 ? "item" : "items"}`}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          !searched && (
            <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
              <Search size={40} className="mb-3 text-gray-300" />
              <p className="text-sm font-medium">
                Search for your favorite products
              </p>
              <p className="text-xs mt-1 text-gray-400">
                Type a keyword above to get started
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

// ✅ Export wrapped in <Suspense> to fix build error
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
