"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
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
  const t = useT();

  // The backend already drops thin collections, but guarding here keeps the
  // component safe to reuse anywhere.
  if (collection.tiles.length < 3) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-extrabold tracking-tight md:text-[19px]">
          {t("home.shopCategory", { category: collection.title })}
        </h2>
        <Link
          href={`/category?id=${collection.id}`}
          prefetch={false}
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide hover:border-[color:var(--color-ink)]"
        >
          {t("common.viewAll")}
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
            <span className="block overflow-hidden rounded-[var(--radius-md)] bg-white ring-1 ring-[color:var(--color-line)]">
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
