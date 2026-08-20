"use client";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";

/**
 * Everything already in the country.
 *
 * A destination rather than a filtered view, because "what can I have this
 * week?" is a different shopping trip from "what is cheapest if I wait?".
 *
 * There is no explanatory header above the grid. The All / In Tanzania / From
 * abroad tabs sit directly under the title and are left unlocked, so they are
 * both the statement of where you are and the way to move — and every card in
 * the grid repeats the answer on its own availability strip. A paragraph here
 * would say a third time what two other elements already say, and push the
 * products below the fold to do it.
 */
export default function LocalShopPage() {
  return (
    <SiteChrome>
      <ListingView
        baseQuery={{ availability: "local" }}
        heading="Available in Tanzania"
        emptyMessage="No local stock matched those filters. Try ordering from abroad, or ask us to source it."
      />
    </SiteChrome>
  );
}
