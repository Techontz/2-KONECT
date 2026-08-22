"use client";

import { useT } from "@/lib/i18n";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";

/**
 * Deals — every discounted, in-stock product, biggest saving first.
 *
 * The "on sale" condition is enforced by the API, not by filtering
 * client-side, so nothing appears here that is not genuinely reduced.
 *
 * Like the other listings this opens straight onto the grid. The banner that
 * used to sit here carried a second <h1>, which gave the page two of them —
 * and said in three lines what the discount badge on every card says by
 * itself.
 */
export default function DealsPage() {
  const t = useT();
  return (
    <SiteChrome>
      <ListingView
        baseQuery={{ on_sale: true, in_stock: true, sort: "discount" }}
        heading={t("listing.dealsHeading")}
        emptyMessage={t("listing.dealsEmpty")}
      />
    </SiteChrome>
  );
}
