"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import shop from "@/lib/shop";
import { BRAND } from "@/lib/brand";
import { formatDate, formatMoney } from "@/lib/format";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import type { ProductCard as ProductCardModel, ProductDetail } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductShelf } from "@/components/product/ProductShelf";
import { SellerActions, SellerPanel } from "@/components/product/SellerPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Button, EmptyState, PriceBlock, Skeleton, Stars, Tag } from "@/components/ui/Primitives";

/**
 * Product detail page.
 *
 * Layout follows the reference: gallery on the left, buying column in the
 * middle, seller / trust panel pinned right, then specifications, reviews and
 * related-product rails beneath.
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
  const t = useT();
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
    // A fresh product means scrolling back to the top — otherwise following a
    // related-product link lands the shopper halfway down the new page.
    window.scrollTo({ top: 0 });

    shop.product(productId).then(setData).catch(() => setMissing(true));
  }, [productId]);

  if (missing) {
    return (
      <EmptyState
        title={t("product.notFound")}
        message={t("product.notFoundHint")}
        action={<Link href="/" className="font-bold text-[color:var(--color-action)] hover:underline">{t("product.continueShopping")}</Link>}
      />
    );
  }

  if (!data) return <PdpSkeleton />;

  const { product, related, from_vendor: fromVendor } = data;
  const saved = wishlist.has(product.id);
  const images = product.images.length > 0 ? product.images : [];

  function addToCart() {
    if (!product.in_stock) return;
    cart.add(toCardModel(product), quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function buyNow() {
    if (!product.in_stock) return;
    cart.add(toCardModel(product), quantity);
    router.push("/checkout");
  }

  return (
    <div className="shell py-4">
      <nav aria-label="Breadcrumb" className="mb-3 text-[12px] text-[color:var(--color-ink-muted)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:underline">{t("common.home")}</Link></li>
          {product.category ? (
            <>
              <li aria-hidden="true">›</li>
              <li>
                <Link href={`/category?id=${product.category.id}`} className="hover:underline">
                  {product.category.name.trim()}
                </Link>
              </li>
            </>
          ) : null}
          {product.subcategory && product.category ? (
            <>
              <li aria-hidden="true">›</li>
              <li>
                <Link
                  href={`/category?id=${product.category.id}&subcategory=${product.subcategory.id}`}
                  className="hover:underline"
                >
                  {product.subcategory.name}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      {/* The single-column track needs an explicit minmax(0,…): a grid item's
          default `min-width: auto` lets wide content push the column past the
          viewport, which is what made products with long titles or many
          thumbnails scroll sideways on a phone. */}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* ---------- gallery ---------- */}
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <ProductGallery
            images={images}
            name={product.name}
            activeIndex={activeImage}
            onSelect={setActiveImage}
          >
            <button
              type="button"
              onClick={() => void wishlist.toggle(product.id)}
              aria-label={saved ? t("product.removeFromWishlist") : t("product.saveToWishlist")}
              aria-pressed={saved}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]"
            >
              <svg viewBox="0 0 24 24" className={`h-5 w-5 ${saved ? "text-[color:var(--color-sale)]" : ""}`}
                fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" />
              </svg>
            </button>
          </ProductGallery>
        </section>

        {/* ---------- buying column ---------- */}
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          {product.vendor ? (
            <Link
              href={`/vendors?id=${product.vendor.id}`}
              className="text-[13px] font-bold text-[color:var(--color-action)] hover:underline"
            >
              {product.vendor.name}
            </Link>
          ) : null}

          <h1 className="mt-1 text-[20px] font-bold leading-snug md:text-[24px]">{product.name}</h1>

          {product.rating.count > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-extrabold">{product.rating.average.toFixed(1)}</span>
              <Stars value={product.rating.average} />
              <a href="#reviews" className="text-[13px] font-semibold text-[color:var(--color-action)] hover:underline">
                {product.rating.count} {product.rating.count === 1 ? t("product.rating") : t("product.ratings")}
              </a>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-[color:var(--color-ink-faint)]">{t("product.noRatings")}</p>
          )}

          <div className="mt-4 border-t border-[color:var(--color-line)] pt-4">
            <PriceBlock price={product.price} size="lg" />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {product.in_stock ? (
                product.stock <= 5 ? (
                  <Tag tone="warn">{t("product.onlyLeft", { count: product.stock })}</Tag>
                ) : (
                  <Tag tone="success">{t("product.inStock")}</Tag>
                )
              ) : (
                <Tag tone="neutral">{t("product.outOfStock")}</Tag>
              )}
              {product.price.discount_percent ? (
                <Tag tone="sale">{t("product.save", { percent: product.price.discount_percent })}</Tag>
              ) : null}
            </div>
          </div>

          {/* quantity + actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)]">
              <QuantityButton label={t("common.decreaseQuantity")} onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>−</QuantityButton>
              <span className="w-10 text-center text-sm font-bold tabular-nums">{quantity}</span>
              <QuantityButton
                label={t("common.increaseQuantity")}
                onClick={() => setQuantity((q) => Math.min(product.stock || 1, q + 1))}
                disabled={quantity >= product.stock}
              >
                +
              </QuantityButton>
            </div>

            <Button onClick={addToCart} disabled={!product.in_stock} size="lg" className="flex-1 min-w-[160px]">
              {added ? `${t("product.added")} ✓` : t("product.addToCart")}
            </Button>
            <Button onClick={buyNow} disabled={!product.in_stock} variant="dark" size="lg" className="flex-1 min-w-[140px]">
              {t("product.buyNow")}
            </Button>
          </div>

          {/* Contact actions sit directly under the buy buttons on a phone,
              where the seller panel is otherwise below a long description.
              From lg they live in the seller panel in the right column. */}
          {product.vendor ? (
            <div className="mt-3 lg:hidden">
              <SellerActions
                vendor={product.vendor}
                product={product}
                onChat={() => setChatOpen(true)}
              />
            </div>
          ) : null}

          {product.description ? (
            <div className="mt-6 border-t border-[color:var(--color-line)] pt-4">
              <h2 className="mb-2 text-[15px] font-extrabold">{t("product.overview")}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
                {product.description}
              </p>
            </div>
          ) : null}

          {product.specifications.length > 0 ? (
            <div className="mt-6 border-t border-[color:var(--color-line)] pt-4">
              <h2 className="mb-3 text-[15px] font-extrabold">{t("product.specifications")}</h2>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {product.specifications.map((spec, index) => (
                  <div
                    key={`${spec.label}-${index}`}
                    className="flex justify-between gap-4 border-b border-[color:var(--color-line)] py-2 text-[13px]"
                  >
                    <dt className="text-[color:var(--color-ink-muted)]">{spec.label}</dt>
                    <dd className="text-right font-semibold">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>

        {/* ---------- seller / trust ---------- */}
        <aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start">
          {product.vendor ? (
            <SellerPanel
              vendor={product.vendor}
              product={product}
              onChat={() => setChatOpen(true)}
            />
          ) : null}

          <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
            <ul className="space-y-3 text-[13px]">
              <TrustRow
                icon="🚚"
                title={t("product.fastDelivery")}
                body={product.vendor?.location ?? t("product.dispatchedFrom", { city: BRAND.city })}
              />
              <TrustRow icon="💵" title={t("payment.cashOnDelivery")} body={t("product.codHint")} />
              <TrustRow icon="↩️" title={t("product.easyReturns")} body={t("product.easyReturnsHint")} />
            </ul>
          </section>
        </aside>
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

      {/* ---------- reviews ---------- */}
      <section id="reviews" className="mt-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
        <h2 className="mb-4 text-[17px] font-extrabold">{t("product.ratingsAndReviews")}</h2>

        {product.rating.count === 0 ? (
          <p className="py-6 text-center text-sm text-[color:var(--color-ink-muted)]">
            {t("product.noReviewsYet")}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <p className="text-[40px] font-black leading-none">{product.rating.average.toFixed(1)}</p>
              <Stars value={product.rating.average} className="h-5 w-5" />
              <p className="mt-1 text-[12px] text-[color:var(--color-ink-muted)]">
                Based on {product.rating.count} {product.rating.count === 1 ? t("product.rating") : t("product.ratings")}
              </p>

              <div className="mt-4 space-y-1.5">
                {product.rating.distribution.map((row) => (
                  <div key={row.star} className="flex items-center gap-2 text-[12px]">
                    <span className="w-8 shrink-0 tabular-nums">{row.star} ★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-line)]">
                      <span
                        className="block h-full rounded-full bg-[color:var(--color-success)]"
                        style={{ width: `${row.percent}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right tabular-nums text-[color:var(--color-ink-muted)]">
                      {row.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="space-y-4">
              {product.reviews.map((review) => (
                <li key={review.id} className="border-b border-[color:var(--color-line)] pb-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-bold">{review.author}</span>
                    <Stars value={review.rating} className="h-3.5 w-3.5" />
                    <span className="text-[11px] text-[color:var(--color-ink-faint)]">
                      {formatDate(review.date)}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
                      {review.comment}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="mt-4 space-y-3">
        <ProductShelf title={t("product.relatedProducts")} products={related} />
        {fromVendor.length > 0 && product.vendor ? (
          <ProductShelf
            title={`More from ${product.vendor.name}`}
            products={fromVendor}
            viewAllHref={`/vendors?id=${product.vendor.id}`}
          />
        ) : null}
      </div>

      {/* Sticky buy bar on mobile — the reference keeps the CTA reachable. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[color:var(--color-line)] bg-white px-4 py-2.5 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="clamp-1 text-[11px] text-[color:var(--color-ink-muted)]">{product.name}</p>
          <p className="text-[15px] font-extrabold">{formatMoney(product.price.current)}</p>
        </div>
        <Button onClick={addToCart} disabled={!product.in_stock} className="shrink-0">
          {added ? `${t("product.added")} ✓` : t("product.addToCart")}
        </Button>
      </div>
      <div className="h-16 lg:hidden" />
    </div>
  );
}

function TrustRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="text-base">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-[12px] text-[color:var(--color-ink-muted)]">{body}</span>
      </span>
    </li>
  );
}

function QuantityButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-full w-10 items-center justify-center text-lg font-bold text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-surface-alt)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * The cart stores the card shape; the PDP holds the richer detail shape.
 * Narrow it here so the cart never has to know about two product types.
 */
function toCardModel(product: ProductDetail): ProductCardModel {
  return {
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
    vendor: product.vendor ? { id: product.vendor.id, name: product.vendor.name } : undefined,
    badges: {
      low_stock: product.stock > 0 && product.stock <= 5,
      out_of_stock: !product.in_stock,
      discounted: Boolean(product.price.discount_percent),
    },
  };
}

function PdpSkeleton() {
  return (
    <div className="shell grid gap-4 py-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,300px)]">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
