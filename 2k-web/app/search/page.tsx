"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { Skeleton } from "@/components/ui/Primitives";
import type { ProductQuery } from "@/lib/shop";

/**
 * Search results.
 *
 * Searching runs on the server against the whole catalogue — the browser never
 * downloads the product list to filter it locally.
 */
export default function SearchPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
        <SearchContent />
      </Suspense>
    </SiteChrome>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const term = params.get("q")?.trim() ?? "";
  const sort = (params.get("sort") as ProductQuery["sort"]) ?? undefined;
  const subcategoryId = params.get("subcategory_id") ? Number(params.get("subcategory_id")) : undefined;
  const vendorId = params.get("vendor_id") ? Number(params.get("vendor_id")) : undefined;

  // `/search` with no term is a valid destination — the nav and the shelves
  // link here to browse a subcategory or a seller — so it browses rather than
  // demanding a query.
  const heading = term
    ? `Results for “${term}”`
    : sort === "rating"
      ? "Top rated"
      : vendorId
        ? "Seller’s products"
        : "Browse products";

  return (
    <ListingView
      baseQuery={{
        q: term || undefined,
        sort,
        subcategory_id: subcategoryId,
        vendor_id: vendorId,
      }}
      heading={heading}
      subheading={term ? undefined : "Everything on 2KONECT, filtered your way."}
      emptyMessage={
        term
          ? `We couldn’t find anything matching “${term}”. Check the spelling, try a broader word — or ask us to source it.`
          : "Try removing a filter, or ask us to source what you need."
      }
    />
  );
}
