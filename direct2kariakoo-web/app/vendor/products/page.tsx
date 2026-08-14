"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/format";
import vendorApi from "@/lib/vendor";
import type { ProductCard } from "@/lib/types";
import { Button, ButtonLink, EmptyState, Skeleton, Tag } from "@/components/ui/Primitives";

/**
 * Vendor product management.
 *
 * A dense table rather than a shopper-style grid — this is inventory work, so
 * stock, price and status need to be scannable down a column.
 */
export default function VendorProductsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const params = useSearchParams();

  const [products, setProducts] = useState<ProductCard[]>([]);
  const [meta, setMeta] = useState<{ total: number; has_more: boolean; current_page: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [stockFilter, setStockFilter] = useState<"" | "low" | "out">(
    (params.get("stock") as "low" | "out") ?? ""
  );
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(
    async (page = 1, append = false) => {
      setLoading(true);
      try {
        const data = await vendorApi.products({
          q: term || undefined,
          stock: stockFilter || undefined,
          page,
        });
        setProducts((current) => (append ? [...current, ...data.products] : data.products));
        setMeta(data.meta);
      } finally {
        setLoading(false);
      }
    },
    [term, stockFilter]
  );

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(1, false), 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(product: ProductCard) {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This removes the listing and its photos from the marketplace.`
    );
    if (!confirmed) return;

    setDeleting(product.id);
    try {
      await vendorApi.deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-black tracking-tight">Products</h1>
          <p className="text-[13px] text-[color:var(--color-ink-muted)]">
            {meta ? `${meta.total.toLocaleString()} listed` : "Loading…"}
          </p>
        </div>
        <ButtonLink href="/vendor/products/new">+ Add product</ButtonLink>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-3">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search your products…"
          aria-label="Search your products"
          className="h-9 min-w-[200px] flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[13px] outline-none focus:border-[color:var(--color-action)]"
        />

        {([["", "All"], ["low", "Low stock"], ["out", "Sold out"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStockFilter(value)}
            className={`h-9 rounded-[var(--radius-sm)] border px-3 text-[13px] font-semibold transition-colors ${
              stockFilter === value
                ? "border-[color:var(--color-action)] bg-[color:var(--color-action-soft)] text-[color:var(--color-action)]"
                : "border-[color:var(--color-line-strong)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && products.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 w-full" />)}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          message={term || stockFilter ? "Try a different search or filter." : "Add your first product to start selling."}
          action={
            term || stockFilter ? (
              <Button onClick={() => { setTerm(""); setStockFilter(""); }}>Clear filters</Button>
            ) : (
              <ButtonLink href="/vendor/products/new">Add product</ButtonLink>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface)]">
            {/* The table scrolls inside its own track so the page never scrolls sideways. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[color:var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                    <th className="px-3 py-2.5 font-bold">Product</th>
                    <th className="px-3 py-2.5 font-bold">Category</th>
                    <th className="px-3 py-2.5 font-bold">Price</th>
                    <th className="px-3 py-2.5 font-bold">Stock</th>
                    <th className="px-3 py-2.5 font-bold">Rating</th>
                    <th className="px-3 py-2.5 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-[color:var(--color-line)] last:border-0 hover:bg-[color:var(--color-surface-alt)]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]">
                            {product.image ? (
                              <img src={product.image} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
                            ) : null}
                          </span>
                          <Link
                            href={`/product?id=${product.id}`}
                            className="clamp-2 max-w-[280px] font-medium hover:underline"
                          >
                            {product.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[color:var(--color-ink-muted)]">
                        {product.category?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold">{formatMoney(product.price.current)}</span>
                        {product.price.discount_percent ? (
                          <span className="ml-1 text-[11px] text-[color:var(--color-sale)]">
                            −{product.price.discount_percent}%
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {product.stock <= 0 ? (
                          <Tag tone="sale">Sold out</Tag>
                        ) : product.stock <= 5 ? (
                          <Tag tone="warn">{product.stock} left</Tag>
                        ) : (
                          <span className="font-semibold">{product.stock}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[color:var(--color-ink-muted)]">
                        {product.rating.count > 0
                          ? `${product.rating.average.toFixed(1)} (${product.rating.count})`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <ButtonLink href={`/vendor/products/edit?id=${product.id}`} variant="secondary" size="sm">
                            Edit
                          </ButtonLink>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleting === product.id}
                            onClick={() => remove(product)}
                            className="text-[color:var(--color-sale)]"
                          >
                            {deleting === product.id ? "…" : "Delete"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {meta?.has_more ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => load((meta.current_page ?? 1) + 1, true)}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
