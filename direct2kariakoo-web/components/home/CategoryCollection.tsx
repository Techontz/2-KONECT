"use client";

import Link from "next/link";
import type { CategoryCollection as CollectionModel } from "@/lib/types";

/**
 * "Shop the category" strip: a category heading and a row of its
 * subcategories, each illustrated by a real product photo from that
 * subcategory.
 *
 * This is how a shopper jumps straight to "Sneakers" or "Skin care" without
 * first landing on a 745-product category page and filtering their way down.
 */
export function CategoryCollection({ collection }: { collection: CollectionModel }) {
  // The backend already drops thin collections, but guarding here keeps the
  // component safe to reuse anywhere.
  if (collection.tiles.length < 3) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-black tracking-[-0.02em] md:text-[21px]">
          Shop {collection.title}
        </h2>
        <Link
          href={`/category?id=${collection.id}`}
          prefetch={false}
          className="flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-1.5 text-[12px] font-bold transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)] sm:min-h-0"
        >
          See all
        </Link>
      </div>

      {/* Scrolls horizontally on a phone, grid on wider screens — the same
          behaviour as the product rails, so the page reads consistently. */}
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-7">
        {collection.tiles.map((tile) => (
          <Link
            key={tile.id}
            href={`/category?id=${tile.category_id}&subcategory=${tile.id}`}
            prefetch={false}
            className="group w-[124px] shrink-0 md:w-auto"
          >
            <span className="block overflow-hidden rounded-[var(--radius-md)] bg-white ring-1 ring-[color:var(--color-line)] transition-all group-hover:ring-[color:var(--color-brand-200)]">
              {tile.image ? (
                <img
                  src={tile.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="block aspect-square w-full bg-[color:var(--color-surface-alt)]" />
              )}
            </span>
            <span className="clamp-2 mt-2 block text-center text-[13px] font-bold leading-tight">
              {tile.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
