"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useVendors } from "@/lib/queries";
import { usePageContent, useT } from "@/lib/i18n";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { EmptyState, Skeleton } from "@/components/ui/Primitives";
import { VerifiedBadge } from "@/components/sourcing/Trust";

/**
 * Seller directory.
 *
 * With `?id=` it becomes that seller's storefront, which is where the product
 * page's seller link has always pointed — previously at a page that did not
 * exist.
 */
export default function VendorsPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-4"><Skeleton className="h-64 w-full" /></div>}>
        <VendorsContent />
      </Suspense>
    </SiteChrome>
  );
}

function VendorsContent() {
  const params = useSearchParams();
  const vendorId = Number(params.get("id")) || null;

  const copy = usePageContent("vendors");
  const t = useT();

  const { data: vendors } = useVendors();

  // ---- a single seller's storefront ----
  if (vendorId) {
    const vendor = vendors?.find((item) => item.id === vendorId);

    return (
      <div className="shell py-4">
        <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
          <Link href="/" className="crumb hover:underline">{t("common.home")}</Link>
          <span aria-hidden="true">›</span>
          <Link href="/vendors" className="crumb hover:underline">{copy.title}</Link>
          {vendor ? (
            <>
              <span aria-hidden="true">›</span>
              <span className="clamp-1 font-semibold text-[color:var(--color-ink)]">{vendor.name}</span>
            </>
          ) : null}
        </nav>

        <ListingView
          baseQuery={{ vendor_id: vendorId }}
          heading={vendor?.name ?? t("product.soldBy")}
        />
      </div>
    );
  }

  // ---- the directory ----
  return (
    <div className="shell py-4 pb-tabbar">
      <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
        <Link href="/" className="crumb hover:underline">{t("common.home")}</Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-[color:var(--color-ink)]">{copy.title}</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-[24px] font-black tracking-[-0.025em] md:text-[30px]">{copy.title}</h1>
        {copy.intro ? (
          <p className="mt-1 max-w-2xl text-[14px] text-[color:var(--color-ink-muted)]">{copy.intro}</p>
        ) : null}
      </header>

      {vendors === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-28" />)}
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState title={copy.empty ?? ""} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <li key={vendor.id}>
              <Link
                href={`/vendors?id=${vendor.id}`}
                prefetch={false}
                className="flex h-full items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 transition-all hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-card)]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-surface-alt)] text-[17px] font-black">
                  {vendor.logo ? (
                    <img src={vendor.logo} alt="" loading="lazy" decoding="async"
                      className="h-full w-full object-cover" />
                  ) : (
                    vendor.name.charAt(0).toUpperCase()
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="clamp-1 text-[15px] font-extrabold">{vendor.name}</span>
                    {vendor.is_verified ? <VerifiedBadge size="sm" label="" className="shrink-0 px-1" /> : null}
                  </span>
                  <span className="block text-[12px] text-[color:var(--color-ink-muted)]">
                    {vendor.product_count.toLocaleString()} {copy.productsLabel}
                  </span>
                  {vendor.member_since ? (
                    <span className="block text-[11px] text-[color:var(--color-ink-faint)]">
                      {(copy.sinceLabel ?? "").replace("{year}", vendor.member_since)}
                    </span>
                  ) : null}
                </span>

                <span aria-hidden="true" className="shrink-0 text-[color:var(--color-ink-faint)]">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
