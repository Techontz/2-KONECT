"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import type { ProductCard as ProductCardModel } from "@/lib/types";
import { PriceBlock, RatingPill, Tag } from "@/components/ui/Primitives";
import { AvailabilityStrip } from "@/components/sourcing/Availability";
import { VerifiedBadge } from "@/components/sourcing/Trust";

/**
 * The single product card used by every grid, shelf and carousel.
 *
 * Its job is to answer four questions before the shopper has to think: what is
 * it, what does it cost, where is it, and when would it arrive. The
 * availability badge sits directly under the photo — above the name — because
 * on 2KONECT that is the difference between two otherwise identical listings.
 *
 * There is deliberately only one implementation; variants are props, not
 * copies.
 */
export function ProductCard({
  product,
  className = "",
}: {
  product: ProductCardModel;
  className?: string;
}) {
  const { add, quantityOf } = useCart();
  const wishlist = useWishlist();
  const [added, setAdded] = useState(false);

  const saved = wishlist.has(product.id);
  const inCart = quantityOf(product.id);
  const href = `/product?id=${product.id}`;
  const sourcing = product.sourcing;

  // An import is bought to order, so a zero on hand does not make it
  // unbuyable — only local stock actually runs out.
  const buyable = sourcing ? (sourcing.is_local ? product.in_stock : true) : product.in_stock;

  function handleAdd(event: React.MouseEvent) {
    // The whole card is a link; the add button must not navigate.
    event.preventDefault();
    event.stopPropagation();
    if (!buyable) return;

    add(product, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  function handleWishlist(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    void wishlist.toggle(product.id);
  }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-hover)] ${className}`}
    >
      <Link href={href} className="flex h-full flex-col" prefetch={false}>
        {/* ---- image plate ---- */}
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          {product.image ? (
            // Plain <img>: images are unoptimized in this deployment anyway,
            // and native lazy loading keeps long grids cheap on a phone.
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-faint)]">
              <BagIcon className="h-10 w-10" />
            </div>
          )}

          {/* Badges sit over the plate, never over the text block. */}
          <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.badges.discounted && product.price.discount_percent ? (
              <Tag tone="sale">−{product.price.discount_percent}%</Tag>
            ) : null}
            {sourcing?.is_local && product.badges.low_stock ? (
              <Tag tone="warn">Only {product.stock} left</Tag>
            ) : null}
            {sourcing?.is_local && product.badges.out_of_stock ? (
              <Tag tone="neutral">Sold out</Tag>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleWishlist}
            aria-label={saved ? `Remove ${product.name} from your saved items` : `Save ${product.name}`}
            aria-pressed={saved}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[color:var(--color-ink)] shadow-[var(--shadow-card)] backdrop-blur transition-colors hover:bg-white"
          >
            <HeartIcon
              className={`h-4 w-4 ${saved ? "text-[color:var(--color-sale)]" : ""}`}
              filled={saved}
            />
          </button>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!buyable}
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[color:var(--color-brand-strong)] disabled:cursor-not-allowed disabled:bg-[color:var(--color-line-strong)] disabled:shadow-none"
          >
            {added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          </button>

          {inCart > 0 ? (
            <span className="absolute bottom-2 left-2 rounded-[var(--radius-xs)] bg-[color:var(--color-ink)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {inCart} in cart
            </span>
          ) : null}
        </div>

        {/* ---- where it is, and when ----
            A full-width tinted strip rather than a small pill: this is the
            field that decides between two otherwise identical listings, so it
            gets the width of the card. */}
        {sourcing ? <AvailabilityStrip sourcing={sourcing} /> : null}

        {/* ---- details ---- */}
        <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
          <h3 className="clamp-2 min-h-[34px] text-[13px] leading-[17px] text-[color:var(--color-ink)]">
            {product.name}
          </h3>

          <PriceBlock price={product.price} size="sm" />

          {/* Reserved so cards with and without ratings stay the same height. */}
          <div className="min-h-[18px]">
            <RatingPill rating={product.rating} />
          </div>

          {product.vendor ? (
            <span className="mt-auto flex min-w-0 items-center gap-1 pt-1">
              <span className="clamp-1 text-[10px] text-[color:var(--color-ink-faint)]">
                {product.vendor.name}
              </span>
              {product.vendor.is_verified ? <VerifiedBadge size="sm" label="" className="px-1" /> : null}
            </span>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

/** Card-shaped placeholder, used while a grid or shelf is loading. */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="skeleton aspect-square w-full rounded-none" />
      <div className="skeleton h-[27px] w-full rounded-none border-y border-[color:var(--color-line)]" />
      <div className="flex flex-col gap-2 p-3">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    </div>
  );
}

/* ---- icons ---- */

function HeartIcon({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function BagIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2l1.5 3h9L18 2M3 7h18l-1.5 13.5a2 2 0 01-2 1.8H6.5a2 2 0 01-2-1.8L3 7z" />
      <path d="M8 11a4 4 0 008 0" />
    </svg>
  );
}

export default ProductCard;
