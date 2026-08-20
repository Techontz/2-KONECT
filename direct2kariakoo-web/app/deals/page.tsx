"use client";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";

/**
 * Deals — every discounted, in-stock product, biggest saving first.
 * The "on sale" condition is enforced by the API, not by filtering client-side.
 */
export default function DealsPage() {
  return (
    <SiteChrome>
      <section className="brand-ground">
        <div className="shell py-8 sm:py-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            2KONECT deals
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.025em] text-white sm:text-[38px]">
            Big price drops, updated daily.
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-white/75 sm:text-[15px]">
            Everything currently discounted across the catalogue — local stock and
            imported alike — sorted by how much you save.
          </p>
        </div>
      </section>

      <ListingView
        baseQuery={{ on_sale: true, in_stock: true, sort: "discount" }}
        heading="All deals"
        subheading="Sorted by biggest discount first."
        emptyMessage="No deals are running right now. Check back soon."
      />
    </SiteChrome>
  );
}
