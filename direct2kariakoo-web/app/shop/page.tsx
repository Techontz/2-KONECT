"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { Skeleton } from "@/components/ui/Primitives";

/**
 * The whole catalogue, wherever it happens to be.
 *
 * The availability toggle at the top of the listing is what makes this page
 * useful: it is the same shelf read two ways rather than two separate shops.
 */
export default function ShopPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
        <ShopContent />
      </Suspense>
    </SiteChrome>
  );
}

function ShopContent() {
  const params = useSearchParams();
  const verified = params.get("verified") === "1";

  return (
    <ListingView
      baseQuery={{ verified: verified || undefined }}
      heading={verified ? "From verified sellers" : "Shop everything"}
      subheading={
        verified
          ? "Businesses we have reviewed and approved."
          : "Every product on 2KONECT — in Tanzania now, or sourced from abroad."
      }
    />
  );
}
