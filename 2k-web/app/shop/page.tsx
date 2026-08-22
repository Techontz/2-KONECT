"use client";

import { useT } from "@/lib/i18n";
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
  const t = useT();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";

  // "Shop by delivery time" on the homepage links here. The window arrives in
  // the URL so the entry point is shareable and the back button behaves, and
  // it is bounded to the same range the API validates rather than trusted.
  const days = Number(params.get("max_days"));
  const maxDays = Number.isFinite(days) && days >= 1 && days <= 120 ? days : undefined;

  const heading = verified
    ? t("home.verifiedSellers")
    : maxDays
      ? t("listing.arrivingWithin", { days: maxDays })
      : t("listing.shopEverything");

  return (
    <ListingView
      baseQuery={{ verified: verified || undefined, max_days: maxDays }}
      heading={heading}
    />
  );
}
