"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { Skeleton } from "@/components/ui/Primitives";
import type { ProductQuery } from "@/lib/shop";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const params = useSearchParams();
  const term = params.get("q")?.trim() ?? "";
  const sort = (params.get("sort") as ProductQuery["sort"]) ?? undefined;

  // `/search` with no term is a valid destination — the promo tiles link here
  // to show "all new arrivals" and "top rated" — so it browses rather than
  // demanding a query.
  const heading = term ? `Results for "${term}"` : sort === "rating" ? t("home.topRated") : t("home.newArrivals");

  return (
    <ListingView
      baseQuery={{ q: term || undefined, sort }}
      heading={heading}
      subheading={term ? undefined : t("search.browseFull")}
      emptyMessage={
        term
          ? `We couldn't find anything matching "${term}". Check the spelling or try a broader word.`
          : t("search.tryDifferentFilter")
      }
    />
  );
}
