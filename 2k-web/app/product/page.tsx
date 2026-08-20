"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import shop from "@/lib/shop";
import { BRAND } from "@/lib/brand";
import { formatDate, formatMoney } from "@/lib/format";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import type { BuyingOption, ProductCard as ProductCardModel, ProductDetail } from "@/lib/types";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductShelf } from "@/components/product/ProductShelf";
import { SellerActions, SellerPanel } from "@/components/product/SellerPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AvailabilityPanel } from "@/components/sourcing/Availability";
import { BuyingOptions } from "@/components/sourcing/BuyingOptions";
import { TrustRow } from "@/components/sourcing/Trust";
import { Button, EmptyState, PriceBlock, Skeleton, Stars, Tag } from "@/components/ui/Primitives";

/**
 * Product detail page.
 *
 * Ordered by the questions a shopper actually asks, in the order they ask
 * them: what is it, how much, *where is it and when do I get it*, who is
 * selling it, and what happens after I pay. The third of those is the one
 * this marketplace is built around, so it sits directly under the price
 * rather than in a shipping tab.
 */
export default function ProductPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<PdpSkeleton />}>
        <ProductContent />
      </Suspense>
    </SiteChrome>
  );
}

function ProductContent() {
  const params = useSearchParams();
  const router = useRouter();
  const productId = Number(params.get("id"));

  const [data, setData] = useState<{
    product: ProductDetail;
    related: ProductCardModel[];
    from_vendor: ProductCardModel[];
  } | null>(null);
  const [missing, setMissing] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [optionIndex, setOptionIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const cart = useCart();
  const wishlist = useWishlist();

  useEffect(() => {
    if (!productId) { setMissing(true); return; }

    setData(null);
    setMissing(false);
    setActiveImage(0);
    setQuantity(1);
    setOptionIndex(0);
    // A fresh product means scrolling back to the top — otherwise following a
    // related-product link lands the shopper halfway down the new page.
    window.scrollTo({ top: 0 });

    shop.product(productId).then(setData).catch(() => setMissing(true));
  }, [productId]);

  const product = data?.product;

  /** Every way to buy this product. Always at least one. */
  const options: BuyingOption[] = useMemo(() => {
    if (!product) return [];
    if (product.buying_options?.length) return product.buying_options;

    // Older payloads (and the Flutter app's shape) have no options array;
    // synthesise the primary offer so the page behaves identically.
    return [{
      id: null,
      price: product.price,
      stock: product.stock,
      in_stock: product.in_stock,
      seller: product.vendor?.name ?? BRAND.name,
      sourcing: product.sourcing,
    }];
  }, [product]);

  if (missing) {
    return (
      <EmptyState
        title="We couldn’t find that product"
        message="It may have been removed, or the link may be wrong."
        action={
          <>
            <Link href="/shop" className="font-bold text-[color:var(--color-brand)] hover:underline">
              Keep shopping
            </Link>
            <Link href="/request" className="font-bold text-[color:var(--color-brand)] hover:underline">
              Ask us to source it
            </Link>
          </>
        }
      />
    );
  }

  if (!product) return <PdpSkeleton />;

  const option = options[Math.min(optionIndex, options.length - 1)] ?? options[0];
  const sourcing = option.sourcing;
  const saved = wishlist.has(product.id);

  // A card-shaped copy of this product, for the cart and the wishlist.
  const card: ProductCardModel = {
    id: product.id,
    name: product.name,
    image: product.image,
    images: product.images,
    price: product.price,
    rating: { average: product.rating.average, count: product.rating.count },
    stock: product.stock,
    in_stock: product.in_stock,
    category: product.category ?? undefined,
    subcategory: product.subcategory ?? undefined,
    vendor: product.vendor
      ? { id: product.vendor.id, name: product.vendor.name, is_verified: product.vendor.is_verified }
      : undefined,
    sourcing: product.sourcing,
    badges: {
      low_stock: product.stock > 0 && product.stock <= 5,
      out_of_stock: product.stock <= 0,
      discounted: product.price.was !== null,
    },
  };

  function addToCart() {
    if (!option.in_stock) return;
    // The chosen alternative travels with the line, so the cart, the checkout
    // and the order all price and date it the same way.
    cart.add(card, quantity, option.id ? option : null);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function buyNow() {
    if (!option.in_stock) return;
    cart.add(card, quantity, option.id ? option : null);
    router.push("/checkout");
  }

  const ceiling = sourcing.is_local ? Math.max(option.stock, 1) : 99;

  return (
    <>
      {/* Structured data, so a search engine can show the price, the currency
          and whether it is in stock. Built from the same payload the page
          renders, never from anything invented. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema(product, option)) }}
      />

      <div className="shell py-3 pb-tabbar">
        <Breadcrumb product={product} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* ---- gallery + long-form content ---- */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 sm:p-4">
              <ProductGallery
                images={product.images.length ? product.images : product.image ? [product.image] : []}
                name={product.name}
                activeIndex={activeImage}
                onSelect={setActiveImage}
              >
                <button
                  type="button"
                  onClick={() => void wishlist.toggle(product.id)}
                  aria-label={saved ? "Remove from saved items" : "Save this product"}
                  aria-pressed={saved}
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/92 shadow-[var(--shadow-card)] backdrop-blur transition-colors hover:bg-white"
                >
                  <HeartIcon
                    className={`h-5 w-5 ${saved ? "text-[color:var(--color-sale)]" : "text-[color:var(--color-ink)]"}`}
                    filled={saved}
                  />
                </button>
              </ProductGallery>
            </div>

            {/* On a phone the buy column renders here, between the gallery and
                the description — a shopper must not have to scroll past 600
                words of specification to find the price. */}
            <div className="lg:hidden">
              <BuyColumn
                product={product}
                options={options}
                optionIndex={optionIndex}
                onOption={(index) => { setOptionIndex(index); setQuantity(1); }}
                quantity={quantity}
                setQuantity={setQuantity}
                ceiling={ceiling}
                added={added}
                onAdd={addToCart}
                onBuy={buyNow}
                onChat={() => setChatOpen(true)}
              />
            </div>

            {product.description ? (
              <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
                <h2 className="text-[16px] font-black">About this product</h2>
                <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[color:var(--color-ink-soft)]">
                  {product.description}
                </p>
              </section>
            ) : null}

            {product.specifications.length > 0 ? (
              <section className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
                <h2 className="border-b border-[color:var(--color-line)] p-4 text-[16px] font-black sm:px-5">
                  Specifications
                </h2>
                <dl className="grid gap-px bg-[color:var(--color-line)] sm:grid-cols-2">
                  {product.specifications.map((spec, index) => (
                    <div key={`${spec.label}-${index}`} className="flex gap-3 bg-[color:var(--color-surface)] px-4 py-2.5 sm:px-5">
                      <dt className="w-[38%] shrink-0 text-[13px] text-[color:var(--color-ink-muted)]">
                        {spec.label}
                      </dt>
                      <dd className="min-w-0 flex-1 text-[13px] font-semibold">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <Reviews product={product} />
          </div>

          {/* ---- buy column, desktop ---- */}
          <div className="hidden min-w-0 space-y-3 lg:block">
            <BuyColumn
              product={product}
              options={options}
              optionIndex={optionIndex}
              onOption={(index) => { setOptionIndex(index); setQuantity(1); }}
              quantity={quantity}
              setQuantity={setQuantity}
              ceiling={ceiling}
              added={added}
              onAdd={addToCart}
              onBuy={buyNow}
              onChat={() => setChatOpen(true)}
            />

            {product.vendor ? (
              <SellerPanel vendor={product.vendor} product={product} onChat={() => setChatOpen(true)} />
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <ProductShelf
            title="You might also like"
            products={data.related}
            viewAllHref={product.category ? `/category?id=${product.category.id}` : undefined}
          />
          {product.vendor ? (
            <ProductShelf
              title={`More from ${product.vendor.name}`}
              products={data.from_vendor}
              viewAllHref={`/search?vendor_id=${product.vendor.id}`}
            />
          ) : null}
        </div>
      </div>

      {/* ---- the sticky buy bar on a phone ---- */}
      <div
        className="fixed inset-x-0 z-30 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 shadow-[0_-4px_16px_rgba(20,12,44,0.08)] lg:hidden"
        style={{ bottom: "calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black leading-none">{formatMoney(option.price.current)}</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
              {sourcing.is_local ? "Delivery" : "Arrives"} {sourcing.lead_time.label}
            </p>
          </div>
          <Button
            onClick={addToCart}
            disabled={!option.in_stock}
            className="shrink-0"
          >
            {added ? "Added ✓" : option.in_stock ? "Add to cart" : "Unavailable"}
          </Button>
        </div>
      </div>

      {product.vendor ? (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          vendorId={product.vendor.id}
          vendorUserId={product.vendor.user_id}
          vendorName={product.vendor.name}
          vendorLogo={product.vendor.logo}
          product={{ id: product.id, name: product.name, image: product.image }}
        />
      ) : null}
    </>
  );
}

/**
 * The buy box.
 *
 * Rendered twice — once in the sidebar on a desktop, once inline on a phone —
 * from one definition, so the two can never drift apart.
 */
function BuyColumn({
  product,
  options,
  optionIndex,
  onOption,
  quantity,
  setQuantity,
  ceiling,
  added,
  onAdd,
  onBuy,
  onChat,
}: {
  product: ProductDetail;
  options: BuyingOption[];
  optionIndex: number;
  onOption(index: number): void;
  quantity: number;
  setQuantity(value: number): void;
  ceiling: number;
  added: boolean;
  onAdd(): void;
  onBuy(): void;
  onChat(): void;
}) {
  const option = options[Math.min(optionIndex, options.length - 1)] ?? options[0];
  const sourcing = option.sourcing;

  return (
    <div className="space-y-3">
      <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
        <h1 className="text-[19px] font-black leading-snug tracking-[-0.02em] sm:text-[22px]">
          {product.name}
        </h1>

        {product.short_description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
            {product.short_description}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {product.rating.count > 0 ? (
            <a href="#reviews" className="flex items-center gap-1.5 text-[12px] hover:underline">
              <Stars value={product.rating.average} className="h-3.5 w-3.5" />
              <span className="font-bold">{product.rating.average.toFixed(1)}</span>
              <span className="text-[color:var(--color-ink-muted)]">({product.rating.count})</span>
            </a>
          ) : (
            <span className="text-[12px] text-[color:var(--color-ink-faint)]">No reviews yet</span>
          )}

          {product.category ? (
            <Link
              href={`/category?id=${product.category.id}`}
              prefetch={false}
              className="tap text-[12px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-brand)]"
            >
              in {product.category.name.trim()}
            </Link>
          ) : null}
        </div>

        {/* Price. When there is only one way to buy it, this is the price;
            when there are two, the selector below carries them and this shows
            the one currently chosen. */}
        <div className="mt-4">
          <PriceBlock price={option.price} size="xl" />
        </div>

        {options.length > 1 ? (
          <BuyingOptions
            options={options}
            selected={optionIndex}
            onSelect={onOption}
            className="mt-4"
          />
        ) : null}
      </section>

      {/* Where it is and when it lands — directly under the price, because on
          2KONECT that is half of what the price means. */}
      <AvailabilityPanel sourcing={sourcing} inStock={option.in_stock} stock={option.stock} />

      <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold">Quantity</span>
          <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)]">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-full w-11 items-center justify-center text-[18px] font-bold disabled:opacity-35"
            >
              −
            </button>
            <input
              type="number"
              value={quantity}
              min={1}
              max={ceiling}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(Number.isFinite(next) ? Math.min(Math.max(1, next), ceiling) : 1);
              }}
              aria-label="Quantity"
              className="h-full w-12 border-x border-[color:var(--color-line-strong)] bg-transparent text-center text-[15px] font-bold outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity(Math.min(ceiling, quantity + 1))}
              disabled={quantity >= ceiling}
              aria-label="Increase quantity"
              className="flex h-full w-11 items-center justify-center text-[18px] font-bold disabled:opacity-35"
            >
              +
            </button>
          </div>

          {sourcing.is_local && option.stock > 0 && option.stock <= 5 ? (
            <Tag tone="warn">Only {option.stock} left</Tag>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2">
          <Button size="lg" onClick={onBuy} disabled={!option.in_stock}>
            {option.in_stock ? "Buy now" : "Currently unavailable"}
          </Button>
          <Button size="lg" variant="secondary" onClick={onAdd} disabled={!option.in_stock}>
            {added ? "Added to cart ✓" : "Add to cart"}
          </Button>
        </div>

        <TrustRow isLocal={sourcing.is_local} className="mt-3" />
      </section>

      {/* Seller contact, phone layout only — the sidebar renders the full
          seller panel instead. */}
      {product.vendor ? (
        <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 lg:hidden">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
            Sold by {product.vendor.name}
          </p>
          <SellerActions vendor={product.vendor} product={product} onChat={onChat} />
        </section>
      ) : null}
    </div>
  );
}

function Reviews({ product }: { product: ProductDetail }) {
  if (product.rating.count === 0 && product.reviews.length === 0) return null;

  return (
    <section id="reviews" className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
      <h2 className="text-[16px] font-black">Reviews</h2>

      <div className="mt-3 grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="text-center sm:text-left">
          <p className="text-[40px] font-black leading-none">{product.rating.average.toFixed(1)}</p>
          <Stars value={product.rating.average} className="mt-1 h-4 w-4" />
          <p className="mt-1 text-[12px] text-[color:var(--color-ink-muted)]">
            {product.rating.count} {product.rating.count === 1 ? "review" : "reviews"}
          </p>
        </div>

        <ul className="space-y-1.5">
          {product.rating.distribution.map((row) => (
            <li key={row.star} className="flex items-center gap-2 text-[12px]">
              <span className="w-8 shrink-0 text-[color:var(--color-ink-muted)]">{row.star}★</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--color-line)]">
                <span
                  className="block h-full rounded-full bg-[color:var(--color-warn)]"
                  style={{ width: `${row.percent}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-[color:var(--color-ink-faint)]">{row.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {product.reviews.length > 0 ? (
        <ul className="mt-5 divide-y divide-[color:var(--color-line)] border-t border-[color:var(--color-line)]">
          {product.reviews.map((review) => (
            <li key={review.id} className="py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold">{review.author}</span>
                <Stars value={review.rating} className="h-3.5 w-3.5" />
                {review.date ? (
                  <span className="text-[11px] text-[color:var(--color-ink-faint)]">
                    {formatDate(review.date)}
                  </span>
                ) : null}
              </div>
              {review.comment ? (
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Breadcrumb({ product }: { product: ProductDetail }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[color:var(--color-ink-muted)]">
      <Link href="/" prefetch={false} className="crumb hover:text-[color:var(--color-brand)]">Home</Link>
      {product.category ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={`/category?id=${product.category.id}`} prefetch={false} className="crumb hover:text-[color:var(--color-brand)]">
            {product.category.name.trim()}
          </Link>
        </>
      ) : null}
      {product.subcategory ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={`/search?subcategory_id=${product.subcategory.id}`} prefetch={false} className="crumb hover:text-[color:var(--color-brand)]">
            {product.subcategory.name.trim()}
          </Link>
        </>
      ) : null}
      <span aria-hidden="true">/</span>
      <span className="crumb clamp-1 max-w-[220px] text-[color:var(--color-ink)]">{product.name}</span>
    </nav>
  );
}

/** schema.org Product, built only from what the API returned. */
function productSchema(product: ProductDetail, option: BuyingOption) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.short_description || product.description || undefined,
    image: product.images.length ? product.images : undefined,
    sku: String(product.id),
    brand: product.vendor ? { "@type": "Brand", name: product.vendor.name } : undefined,
    aggregateRating: product.rating.count > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: product.rating.average,
          reviewCount: product.rating.count,
        }
      : undefined,
    offers: {
      "@type": "Offer",
      price: option.price.current,
      priceCurrency: option.price.currency,
      availability: option.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: option.seller },
    },
  };
}

function PdpSkeleton() {
  return (
    <div className="shell grid gap-4 py-3 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4">
        <Skeleton className="aspect-square w-full rounded-[var(--radius-md)]" />
        <Skeleton className="h-40 w-full rounded-[var(--radius-md)]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-52 w-full rounded-[var(--radius-md)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-md)]" />
        <Skeleton className="h-40 w-full rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

function HeartIcon({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" />
    </svg>
  );
}
