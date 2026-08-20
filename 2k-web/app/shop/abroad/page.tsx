"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { AvailabilityHeader } from "@/components/product/AvailabilityHeader";
import { HowImportsWork } from "@/components/home/HomeSections";
import { Skeleton } from "@/components/ui/Primitives";
import { COUNTRIES } from "@/lib/countries";

/**
 * Everything 2KONECT will bring in for you.
 *
 * The unfamiliar half of the marketplace, so the page explains the process
 * before the grid rather than after it.
 */
export default function AbroadShopPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
        <AbroadContent />
      </Suspense>
    </SiteChrome>
  );
}

function AbroadContent() {
  const params = useSearchParams();
  // "Shop by country" links here. Only a two-letter code we recognise is
  // accepted — anything else is ignored rather than passed to the API.
  const raw = (params.get("country") ?? "").toUpperCase();
  const country = COUNTRIES[raw] ? raw : undefined;
  const origin = country ? COUNTRIES[country] : null;

  return (
    <>
      <AvailabilityHeader
        tone="import"
        flag={origin ? origin.flag : "🌍"}
        eyebrow={origin ? `Sourced from ${origin.name}` : "Order from abroad"}
        title={origin ? `Bringing it in from ${origin.name}.` : "Lower prices. We bring it in."}
        blurb="Products sourced from suppliers outside Tanzania. You pay once, we buy it, import it and deliver it — and you can see where it is the whole way."
        facts={[
          { label: "Arrival", value: "7–14 days typical" },
          { label: "Handled by", value: "2KONECT" },
          { label: "Tracking", value: "Every step" },
        ]}
        otherHref="/shop/local"
        otherLabel="Need it this week? Shop local stock →"
      />

      <ListingView
        baseQuery={{ availability: "import", source_country: country }}
        lockAvailability
        heading={origin ? `From ${origin.name}` : "Order from abroad"}
        subheading={
          origin
            ? `Everything we currently source from ${origin.name}.`
            : "Sourced worldwide and delivered to your door."
        }
        emptyMessage="Nothing matched those filters. Tell us what you need and we will source it."
      />

      <div className="shell pb-8">
        <HowImportsWork />
      </div>
    </>
  );
}
