"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import shop from "@/lib/shop";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { EmptyState, Skeleton } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * Category page.
 *
 * Routing is by query string (`/category?id=8&subcategory=33`) rather than a
 * path segment because the site is deployed as a static export — a dynamic
 * `[id]` route would have to pre-render a page per category at build time and
 * would miss anything added afterwards.
 */
export default function CategoryPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
        <CategoryContent />
      </Suspense>
    </SiteChrome>
  );
}

function CategoryContent() {
  const t = useT();
  const params = useSearchParams();
  const categoryId = Number(params.get("id"));
  const subcategoryId = params.get("subcategory") ? Number(params.get("subcategory")) : undefined;

  const [detail, setDetail] = useState<Awaited<ReturnType<typeof shop.category>> | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setMissing(true);
      return;
    }

    setDetail(null);
    setMissing(false);

    shop
      .category(categoryId)
      .then(setDetail)
      .catch(() => setMissing(true));
  }, [categoryId]);

  if (missing) {
    return (
      <EmptyState
        title={t("listing.categoryNotFound")}
        message={t("listing.categoryNotFoundHint")}
        action={<Link href="/" className="font-bold text-[color:var(--color-action)] hover:underline">Back to home</Link>}
      />
    );
  }

  const activeSub = detail?.subcategories.find((sub) => sub.id === subcategoryId);

  return (
    <>
      {/* Subcategory shortcut rail — the reference shows these as a scrollable
          strip of round tiles directly under the category heading. */}
      {detail && detail.subcategories.length > 0 ? (
        <div className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <div className="shell">
            <div className="rail gap-2 py-3">
              <SubcategoryTile
                href={`/category?id=${categoryId}`}
                label="All"
                image={detail.category.image}
                active={!subcategoryId}
              />
              {detail.subcategories.map((sub) => (
                <SubcategoryTile
                  key={sub.id}
                  href={`/category?id=${categoryId}&subcategory=${sub.id}`}
                  label={sub.name}
                  image={sub.image}
                  count={sub.product_count}
                  active={sub.id === subcategoryId}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav aria-label="Breadcrumb" className="shell pt-3 text-[12px] text-[color:var(--color-ink-muted)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="crumb hover:underline">{t("common.home")}</Link></li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href={`/category?id=${categoryId}`} className="crumb hover:underline">
              {detail?.category.name.trim() ?? t("listing.category")}
            </Link>
          </li>
          {activeSub ? (
            <>
              <li aria-hidden="true">›</li>
              <li className="font-semibold text-[color:var(--color-ink)]">{activeSub.name}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <ListingView
        baseQuery={{ category_id: categoryId, subcategory_id: subcategoryId }}
        heading={activeSub?.name ?? detail?.category.name.trim() ?? t("header.products")}
        subheading={
          activeSub
            ? `${activeSub.name} in ${detail?.category.name.trim()}`
            : t("listing.browseCategory")
        }
      />
    </>
  );
}

function SubcategoryTile({
  href,
  label,
  image,
  count,
  active,
}: {
  href: string;
  label: string;
  image: string | null;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 text-center"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-surface-alt)] transition-all ${
          active
            ? "ring-2 ring-[color:var(--color-action)]"
            : "ring-1 ring-[color:var(--color-line)] hover:ring-[color:var(--color-line-strong)]"
        }`}
      >
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl">🛍️</span>
        )}
      </span>
      <span className={`clamp-2 text-[11px] leading-tight ${active ? "font-bold" : "font-medium"}`}>
        {label}
      </span>
      {count !== undefined ? (
        <span className="text-[10px] text-[color:var(--color-ink-faint)]">{count}</span>
      ) : null}
    </Link>
  );
}
