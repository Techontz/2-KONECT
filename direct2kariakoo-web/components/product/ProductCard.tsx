"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import type { ProductCard as ProductCardModel } from "@/lib/types";
import { DeliveryPill, PriceBlock, RatingPill, Tag } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * The single product card used by every grid, shelf and carousel on the site.
 *
 * Composition follows the reference storefront exactly: square image plate,
 * wishlist heart floating top-right, a round add-to-cart button bottom-right
 * of the plate, then title, rating, price and delivery meta stacked beneath.
 * There is deliberately only one implementation — variants are props, not
 * copies.
 */
export function ProductCard({
  product,
  className = "",
}: {
  product: ProductCardModel;
  className?: string;
}) {
  const t = useT();
  const { add, quantityOf } = useCart();
  const wishlist = useWishlist();
  const [added, setAdded] = useState(false);

  const saved = wishlist.has(product.id);
  const inCart = quantityOf(product.id);
  const href = `/product?id=${product.id}`;

  function handleAdd(event: React.MouseEvent) {
    // The whole card is a link; the add button must not navigate.
    event.preventDefault();
    event.stopPropagation();
    if (!product.in_stock) return;

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
      className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] transition-shadow hover:shadow-[var(--shadow-hover)] ${className}`}
    >
      <Link href={href} className="flex h-full flex-col" prefetch={false}>
        {/* ---- image plate ---- */}
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          {product.image ? (
            // Plain <img>: images are unoptimized in this static export anyway,
            // and native lazy loading keeps long grids cheap.
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-faint)]">
              <BagIcon className="h-10 w-10" />
            </div>
          )}

          {/* Badges sit over the plate, never over the text block. */}
          <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.badges.discounted && product.price.discount_percent ? (
              <Tag tone="sale">{product.price.discount_percent}% off</Tag>
            ) : null}
            {product.badges.low_stock ? <Tag tone="warn">Only {product.stock} left</Tag> : null}
            {product.badges.out_of_stock ? <Tag tone="neutral">{t("product.soldOut")}</Tag> : null}
          </div>

          <button
            type="button"
            onClick={handleWishlist}
            aria-label={saved ? t("product.removeFromWishlist") : t("product.saveToWishlist")}
            aria-pressed={saved}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[color:var(--color-ink)] shadow-[var(--shadow-card)] backdrop-blur transition-colors hover:bg-white"
          >
            <HeartIcon
              className={`h-4 w-4 ${saved ? "text-[color:var(--color-sale)]" : ""}`}
              filled={saved}
            />
          </button>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!product.in_stock}
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-ink)] shadow-[var(--shadow-card)] ring-1 ring-[color:var(--color-line)] transition-all hover:bg-[color:var(--color-action)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[color:var(--color-surface)] disabled:hover:text-[color:var(--color-ink)]"
          >
            {added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          </button>

          {inCart > 0 ? (
            <span className="absolute bottom-2 left-2 rounded-[var(--radius-xs)] bg-[color:var(--color-action)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {inCart} in cart
            </span>
          ) : null}
        </div>

        {/* ---- details ---- */}
        <div className="flex flex-1 flex-col gap-1.5 border-t border-[color:var(--color-line)] p-3">
          <h3 className="clamp-2 min-h-[34px] text-[13px] leading-[17px] text-[color:var(--color-ink)]">
            {product.name}
          </h3>

          {/* Reserved so cards with and without ratings stay the same height. */}
          <div className="min-h-[18px]">
            <RatingPill rating={product.rating} />
          </div>

          <PriceBlock price={product.price} />

          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
            <DeliveryPill />
            {product.vendor ? (
              <span className="clamp-1 text-[10px] text-[color:var(--color-ink-faint)]">
                {product.vendor.name}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

/** Card-shaped placeholder, used while a grid or shelf is loading. */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="skeleton aspect-square w-full" />
      <div className="flex flex-col gap-2 border-t border-[color:var(--color-line)] p-3">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-4 w-20 rounded" />
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
