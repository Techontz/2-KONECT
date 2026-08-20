"use client";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { AvailabilityHeader } from "@/components/product/AvailabilityHeader";
import { HowImportsWork } from "@/components/home/HomeSections";

/**
 * Everything 2KONECT will bring in for you.
 *
 * The unfamiliar half of the marketplace, so the page explains the process
 * before the grid rather than after it.
 */
export default function AbroadShopPage() {
  return (
    <SiteChrome>
      <AvailabilityHeader
        tone="import"
        flag="🌍"
        eyebrow="Order from abroad"
        title="Lower prices. We bring it in."
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
        baseQuery={{ availability: "import" }}
        lockAvailability
        heading="Order from abroad"
        subheading="Sourced worldwide and delivered to your door."
        emptyMessage="Nothing matched those filters. Tell us what you need and we will source it."
      />

      <div className="shell pb-8">
        <HowImportsWork />
      </div>
    </SiteChrome>
  );
}
