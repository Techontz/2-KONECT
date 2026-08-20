"use client";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { AvailabilityHeader } from "@/components/product/AvailabilityHeader";

/**
 * Everything already in the country.
 *
 * A destination rather than a filtered view, because "what can I have this
 * week?" is a different shopping trip from "what is cheapest if I wait?".
 */
export default function LocalShopPage() {
  return (
    <SiteChrome>
      <AvailabilityHeader
        tone="local"
        flag="🇹🇿"
        eyebrow="Available in Tanzania"
        title="In stock here. Delivered in days."
        blurb="Products already held by sellers in Tanzania. You pay, they ship, and it reaches you in one to three days across Dar es Salaam."
        facts={[
          { label: "Delivery", value: "1–3 days" },
          { label: "Stock", value: "Held locally" },
          { label: "Price", value: "Local rate" },
        ]}
        otherHref="/shop/abroad"
        otherLabel="Prefer a lower price? Order from abroad →"
      />

      <ListingView
        baseQuery={{ availability: "local" }}
        lockAvailability
        heading="Available in Tanzania"
        subheading="Ready to ship right now."
        emptyMessage="No local stock matched those filters. Try ordering from abroad, or ask us to source it."
      />
    </SiteChrome>
  );
}
