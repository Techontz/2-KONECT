"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import shop from "@/lib/shop";
import { useAuth } from "@/lib/store/auth";
import { useWishlist } from "@/lib/store/wishlist";
import type { ProductCard as ProductCardModel } from "@/lib/types";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ProductGrid } from "@/components/product/ProductShelf";
import { Button, ButtonLink, EmptyState } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * Wishlist.
 *
 * Signed in, the list comes from the server. Signed out, the ids are held
 * locally and the products are fetched by id — so a guest still sees a working
 * wishlist rather than a login wall.
 */
export default function WishlistPage() {
  return (
    <SiteChrome>
      <WishlistContent />
    </SiteChrome>
  );
}

function WishlistContent() {
  const t = useT();
  const { isAuthenticated, ready, openAuthPrompt } = useAuth();
  const wishlist = useWishlist();

  const [products, setProducts] = useState<ProductCardModel[]>([]);
  const [loading, setLoading] = useState(true);

  const idKey = wishlist.ids.join(",");

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        if (isAuthenticated) {
          const data = await shop.wishlist();
          if (!cancelled) setProducts(data.products);
          return;
        }

        if (wishlist.ids.length === 0) {
          if (!cancelled) setProducts([]);
          return;
        }

        // Guests: resolve the locally-saved ids into real products. Requested
        // in one page big enough to hold the list rather than one call per id.
        const listing = await shop.products({ per_page: 60 });
        const saved = new Set(wishlist.ids);
        const found = listing.products.filter((product) => saved.has(product.id));

        // Anything not on the first page is fetched individually — rare, and
        // bounded by how many items a guest has actually saved.
        const missing = wishlist.ids.filter((id) => !found.some((p) => p.id === id));
        const extra = await Promise.all(
          missing.slice(0, 24).map((id) =>
            shop.product(id).then((data) => toCard(data.product)).catch(() => null)
          )
        );

        if (!cancelled) {
          setProducts([...found, ...extra.filter(Boolean as unknown as (v: unknown) => boolean)] as ProductCardModel[]);
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthenticated, idKey]);

  if (!loading && products.length === 0) {
    return (
      <EmptyState
        icon={<HeartIcon className="h-9 w-9" />}
        title={t("wishlist.empty")}
        message={t("wishlist.emptyHint")}
        action={<ButtonLink href="/" size="lg">{t("wishlist.browse")}</ButtonLink>}
      />
    );
  }

  return (
    <div className="shell py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight md:text-[26px]">
          Wishlist <span className="text-[color:var(--color-ink-muted)]">({wishlist.count})</span>
        </h1>

        {!isAuthenticated && ready ? (
          <button
            type="button"
            onClick={openAuthPrompt}
            className="text-[13px] font-bold text-[color:var(--color-action)] hover:underline"
          >
            Sign in to save this across devices
          </button>
        ) : null}
      </div>

      <ProductGrid products={products} loading={loading} skeletonCount={8} />
    </div>
  );
}

function toCard(product: Awaited<ReturnType<typeof shop.product>>["product"]): ProductCardModel {
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

function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z" />
    </svg>
  );
}
