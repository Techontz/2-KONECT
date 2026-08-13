"use client";
import { useState } from "react";
import axios from "axios";
import { Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  let timeout: NodeJS.Timeout;

  const fetchResults = async (value: string) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/products/search?q=${encodeURIComponent(value)}`
      );
      setResults(res.data.products || []);
      setShow(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (v: string) => {
    setQuery(v);
    clearTimeout(timeout);
    if (v.length < 2) {
      setShow(false);
      return;
    }
    timeout = setTimeout(() => fetchResults(v), 400);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query.length >= 2 && setShow(true)}
        onKeyDown={(e) => e.key === "Enter" && router.push(`/user/search?q=${query}`)}
        placeholder="What are you looking for?"
        className="w-full py-2.5 pl-4 pr-10 bg-white border border-gray-300 rounded-md text-sm text-gray-800
                   focus:outline-none focus:ring-2 focus:ring-[#FFD100] hover:shadow-sm transition-all duration-200"
      />
      <Search
        size={20}
        className="absolute right-3 top-2.5 text-gray-600 cursor-pointer"
        onClick={() => router.push(`/user/search?q=${query}`)}
      />

      {show && (
        <div className="absolute top-11 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading && <p className="p-3 text-gray-500 text-sm">Searching...</p>}
          {!loading &&
            results.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/user/products?id=${r.id}`)}
                className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer"
              >
                <Image
                  src={r.images?.[0] || "/placeholder.png"}
                  alt={r.name}
                  width={40}
                  height={40}
                  className="rounded-md object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">
                    {r.name}
                  </p>
                  <p className="text-xs text-gray-600">TZS {r.new_price}</p>
                </div>
              </div>
            ))}
          {!loading && results.length === 0 && (
            <p className="p-3 text-gray-500 text-sm">No results found.</p>
          )}
        </div>
      )}
    </div>
  );
}
