"use client";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";

/**
 * Deals — every discounted, in-stock product, biggest saving first.
 * The "on sale" condition is enforced by the API, not by filtering client-side.
 */
export default function DealsPage() {
  const t = useT();
  return (
    <SiteChrome>
      <div className="bg-[color:var(--color-brand)]">
        <div className="shell py-8">
          <p className="text-[11px] font-extrabold uppercase tracking-widest opacity-70">
            {t("deals.title", { brand: BRAND.short })}
          </p>
          <h1 className="text-[30px] font-black leading-tight md:text-[38px]">
            {t("deals.subtitle")}
          </h1>
          <p className="mt-1 max-w-xl text-sm opacity-80">{t("deals.intro")}</p>
        </div>
      </div>

      <ListingView
        baseQuery={{ on_sale: true, in_stock: true, sort: "discount" }}
        heading={t("deals.allDeals")}
        subheading={t("deals.sortedByDiscount")}
        emptyMessage={t("deals.none")}
      />
    </SiteChrome>
  );
}
