"use client";

import Link from "next/link";

import { useCategories } from "@/lib/queries";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { EmptyState, Skeleton } from "@/components/ui/Primitives";

/**
 * Every category, in full.
 *
 * The header's mega menu is for a shopper who already knows where they are
 * going; this is for one who is browsing, and it is also the page a crawler
 * follows to reach the depth of the catalogue.
 */
export default function CategoriesPage() {
  // Shared with the header's category tree: whichever loads first, the other
  // reads it from the cache rather than asking again.
  const { data: categories, error: failed } = useCategories();

  return (
    <SiteChrome>
      <div className="shell py-5 pb-tabbar">
        <h1 className="text-[24px] font-black tracking-[-0.025em] sm:text-[30px]">
          Browse every category
        </h1>
        <p className="mt-1 text-[14px] text-[color:var(--color-ink-muted)]">
          Local stock and imported options in each one.
        </p>

        {failed ? (
          <EmptyState
            title="We couldn’t load the categories"
            message="Check your connection and try again."
          />
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories === null
              ? Array.from({ length: 9 }).map((_, index) => (
                  <Skeleton key={index} className="h-44 rounded-[var(--radius-md)]" />
                ))
              : categories.map((category) => (
                  <section
                    key={category.id}
                    className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4"
                  >
                    <Link
                      href={`/category?id=${category.id}`}
                      prefetch={false}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-line)] bg-white">
                        {category.image ? (
                          <img src={category.image} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
                        ) : (
                          <span aria-hidden="true" className="text-[18px]">🛍️</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-extrabold hover:text-[color:var(--color-brand)]">
                          {category.name.trim()}
                        </span>
                        <span className="text-[12px] text-[color:var(--color-ink-faint)]">
                          {category.product_count.toLocaleString()} products
                        </span>
                      </span>
                    </Link>

                    {category.subcategories.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-[color:var(--color-line)] pt-3">
                        {category.subcategories.slice(0, 8).map((sub) => (
                          <li key={sub.id}>
                            <Link
                              href={`/search?subcategory_id=${sub.id}`}
                              prefetch={false}
                              className="inline-flex min-h-[30px] items-center rounded-[var(--radius-pill)] bg-[color:var(--color-surface-alt)] px-2.5 text-[12px] text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand)]"
                            >
                              {sub.name.trim()}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
          </div>
        )}
      </div>
    </SiteChrome>
  );
}
