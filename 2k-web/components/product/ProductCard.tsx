"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";

import { prefetchProduct, seedProductPreview } from "@/lib/queries";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import type { ProductCard as ProductCardModel } from "@/lib/types";
import { PriceBlock, RatingPill, Tag } from "@/components/ui/Primitives";
import { AvailabilityStrip } from "@/components/sourcing/Availability";
import { StockLevel } from "./StockLevel";
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
 *
 * Opening one is made to feel immediate in two steps. Reaching for the card —
 * a pointer entering it, or a finger landing on it — starts fetching the
 * product's detail payload, so by the time the tap registers the answer is
 * usually already back. And the card hands the product page the copy of itself
 * it is holding, so the photo, name and price are on screen from the first
 * frame rather than after a round trip.
 *
 * Prefetching is driven by intent, not by rendering: a grid of twenty-four
 * cards issues no requests until one of them is actually approached.
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
  const sourcing = product.sourcing;

  // An import is bought to order, so a zero on hand does not make it
  // unbuyable — only local stock actually runs out.
  const buyable = sourcing ? (sourcing.is_local ? product.in_stock : true) : product.in_stock;

  /**
   * Warm the destination. Cheap and idempotent — an id already held is
   * returned from the cache without touching the network — but still deferred
   * to a real gesture so that scrolling past a shelf costs nothing.
   */
  function warm() {
    seedProductPreview(product);
    prefetchProduct(product.id);
  }

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
      className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] transition-all duration-200 hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-hover)] ${className}`}
      onPointerEnter={warm}
      onTouchStart={warm}
    >
      {/* `prefetch` left off: the product route's own chunk is shared by every
          card on the page and is fetched once by the first link Next sees. It
          is the *data* that differs per card, and that is handled above. */}
      <Link href={href} className="flex h-full flex-col" prefetch={false} onFocus={warm}>
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
              <Tag tone="warn">{t("product.onlyLeftShort", { count: product.stock })}</Tag>
            ) : null}
            {sourcing?.is_local && product.badges.out_of_stock ? (
              <Tag tone="neutral">{t("product.soldOut")}</Tag>
            ) : null}
          </div>

          {/* Both controls are 44px under a thumb and step back down to the
              tighter desktop size from sm up, where a pointer is precise and
              a 44px disc over a 200px photograph is just weight. */}
          <button
            type="button"
            onClick={handleWishlist}
            aria-label={saved
              ? t("product.removeFromSaved", { name: product.name })
              : t("product.saveItem", { name: product.name })}
            aria-pressed={saved}
            className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[color:var(--color-ink)] shadow-[var(--shadow-card)] backdrop-blur transition-colors hover:bg-white sm:right-2 sm:top-2 sm:h-9 sm:w-9"
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
            aria-label={t("product.addNamedToCart", { name: product.name })}
            className="absolute bottom-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[color:var(--color-brand-strong)] disabled:cursor-not-allowed disabled:bg-[color:var(--color-line-strong)] disabled:shadow-none sm:bottom-2 sm:right-2 sm:h-10 sm:w-10"
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
            gets the width of the card. It sits directly beneath the photo,
            above the name, because in a scanned grid the eye reaches it before
            it has finished reading the title. */}
        {sourcing ? <AvailabilityStrip sourcing={sourcing} /> : null}

        {/* ---- details ----
            Read in the order a shopper scans a grid: what it is, then what it
            costs, then who is selling it.

            Nothing in here reserves space for something that is not there.
            Two earlier reserves — two lines of title whether or not the name
            needed them, and a rating row for products that have no reviews —
            put roughly 30px of nothing between the name and the price, which
            is the single most important adjacency on the card. Both are gone:
            the title takes one line or two as the name requires, and the
            rating renders only when it exists.

            Cards in a row still finish level, because the grid stretches them
            and `mt-auto` on the seller line collects whatever slack there is
            at the bottom of the card rather than in the middle of it. */}
        <div className="flex flex-1 flex-col p-2.5 sm:p-3">
          <h3 className="clamp-2 text-[12.5px] font-medium leading-[17px] text-[color:var(--color-ink-soft)]">
            {product.name}
          </h3>

          {product.rating.count ? (
            <div className="mt-1">
              <RatingPill rating={product.rating} />
            </div>
          ) : null}

          {/* "From" when the price depends on a choice the shopper has not
              made yet, so the grid never quotes the cheapest combination as
              though it were the price of the product. */}
          <div className="mt-1.5">
            {product.price_from ? (
              <span className="mr-1 align-middle text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                {t("product.from")}
              </span>
            ) : null}
            <span className="align-middle">
              <PriceBlock price={product.price} size="md" />
            </span>
          </div>

          {/* Stock, and a bulk-pricing hint where the seller configured tiers.
              One short line at the card's smallest size, sharing a row rather
              than taking two — the height of this block was hard-won and
              neither of these earns a row of its own. */}
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1 leading-[15px]">
            <StockLevel
              stock={product.stock}
              toOrder={product.stock <= 0 && !product.sourcing?.is_local}
            />
            {product.has_bulk_pricing ? (
              <span className="clamp-1 text-[10.5px] font-medium text-[color:var(--color-brand-600)]">
                · Bulk pricing
              </span>
            ) : null}
          </div>

          {product.vendor ? (
            <div className="mt-auto flex min-w-0 items-center gap-1 pt-2">
              <span className="clamp-1 text-[10.5px] text-[color:var(--color-ink-faint)]">
                {product.vendor.name}
              </span>
              {product.vendor.is_verified ? <VerifiedBadge size="sm" label="" className="px-1" /> : null}
            </div>
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
      <div className="flex flex-col p-3">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton mt-1 h-3 w-2/3 rounded" />
        <div className="skeleton mt-2.5 h-4 w-1/2 rounded" />
        <div className="skeleton mt-3 h-3 w-24 rounded" />
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
