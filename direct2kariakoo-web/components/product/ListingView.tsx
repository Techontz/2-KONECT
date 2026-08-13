"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import shop, { type ProductQuery } from "@/lib/shop";
import { formatMoney } from "@/lib/format";
import type { ListingFilters, ProductCard as ProductCardModel } from "@/lib/types";
import { ProductGrid } from "./ProductShelf";
import { Button, EmptyState } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * The shared product-listing surface behind the category, search and deals
 * pages: filter sidebar, sort control, result count and a paginated grid.
 *
 * The reference storefront uses one listing chrome everywhere, so this is one
 * component parameterised by its base query rather than three near-copies.
 */

// Labels are dictionary paths rather than text: the list is module-level, so
// it cannot call the hook, and the option must re-render when language changes.
const SORTS = [
  { value: "relevance", label: "listing.sortRecommended" },
  { value: "newest", label: "listing.sortNewest" },
  { value: "price_asc", label: "listing.sortPriceAsc" },
  { value: "price_desc", label: "listing.sortPriceDesc" },
  { value: "rating", label: "listing.sortRating" },
  { value: "discount", label: "listing.sortDiscount" },
] as const;

export function ListingView({
  baseQuery,
  heading,
  subheading,
  emptyMessage,
}: {
  baseQuery: ProductQuery;
  heading: string;
  subheading?: string;
  emptyMessage?: string;
}) {
  const t = useT();
  const [products, setProducts] = useState<ProductCardModel[]>([]);
  const [filters, setFilters] = useState<ListingFilters | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sort, setSort] = useState<ProductQuery["sort"]>("relevance");
  const [subcategoryId, setSubcategoryId] = useState<number | undefined>(baseQuery.subcategory_id);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [priceCap, setPriceCap] = useState<number | undefined>();

  // Serialised so the effect re-runs when the caller changes category/search
  // without needing the object identity to be stable.
  const baseKey = JSON.stringify(baseQuery);

  useEffect(() => {
    setSubcategoryId(baseQuery.subcategory_id);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  const query = useMemo<ProductQuery>(
    () => ({
      ...baseQuery,
      subcategory_id: subcategoryId,
      sort,
      in_stock: inStockOnly || undefined,
      on_sale: onSaleOnly || undefined,
      max_price: priceCap,
      per_page: 24,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, subcategoryId, sort, inStockOnly, onSaleOnly, priceCap]
  );

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      append ? setLoadingMore(true) : setLoading(true);
      setFailed(false);

      try {
        const data = await shop.products({ ...query, page: targetPage });
        setProducts((current) => (append ? [...current, ...data.products] : data.products));
        setFilters(data.filters);
        setTotal(data.meta.total);
        setHasMore(data.meta.has_more);
        setPage(data.meta.current_page);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query]
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  function resetFilters() {
    setSubcategoryId(baseQuery.subcategory_id);
    setInStockOnly(false);
    setOnSaleOnly(false);
    setPriceCap(undefined);
    setSort("relevance");
  }

  const activeFilterCount =
    (subcategoryId && subcategoryId !== baseQuery.subcategory_id ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (priceCap ? 1 : 0);

  const sidebar = (
    <FilterPanel
      filters={filters}
      subcategoryId={subcategoryId}
      onSubcategory={setSubcategoryId}
      inStockOnly={inStockOnly}
      onInStock={setInStockOnly}
      onSaleOnly={onSaleOnly}
      onOnSale={setOnSaleOnly}
      priceCap={priceCap}
      onPriceCap={setPriceCap}
      onReset={resetFilters}
      activeCount={activeFilterCount}
    />
  );

  return (
    <div className="shell py-4">
      <header className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight md:text-[26px]">{heading}</h1>
        {subheading ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{subheading}</p>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">{sidebar}</aside>

        <div>
          {/* toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] px-4 py-3">
            <p className="text-sm text-[color:var(--color-ink-muted)]">
              {loading ? t("common.loading") : (
                <>
                  <span className="font-bold text-[color:var(--color-ink)]">{total.toLocaleString()}</span>{" "}
                  {total === 1 ? t("listing.productCountOne") : t("header.products")}
                </>
              )}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-1.5 text-[13px] font-semibold lg:hidden"
              >
                {t("listing.filters")}
                {activeFilterCount > 0 ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--color-action)] text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>

              <label className="flex items-center gap-2 text-[13px]">
                <span className="hidden text-[color:var(--color-ink-muted)] sm:inline">{t("listing.sortBy")}</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ProductQuery["sort"])}
                  className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-2 text-[13px] font-semibold outline-none"
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>{t(option.label)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {failed ? (
            <EmptyState
              title={t("home.loadFailed")}
              message={t("listing.serverError")}
              action={<Button onClick={() => load(1, false)}>{t("common.retry")}</Button>}
            />
          ) : !loading && products.length === 0 ? (
            <EmptyState
              title={t("listing.noResults")}
              message={emptyMessage ?? t("listing.noResultsHint")}
              action={activeFilterCount > 0 ? <Button onClick={resetFilters}>{t("common.clear")}</Button> : undefined}
            />
          ) : (
            <>
              <ProductGrid products={products} loading={loading} />

              {hasMore ? (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={loadingMore}
                    onClick={() => load(page + 1, true)}
                  >
                    {loadingMore ? t("common.loading") : t("listing.showMore")}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={t("listing.filters")}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-[color:var(--color-canvas)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold">{t("listing.filters")}</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label={t("listing.closeFilters")} className="p-1">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {sidebar}
            <Button className="mt-4 w-full" size="lg" onClick={() => setFiltersOpen(false)}>
              Show {total.toLocaleString()} products
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterPanel({
  filters,
  subcategoryId,
  onSubcategory,
  inStockOnly,
  onInStock,
  onSaleOnly,
  onOnSale,
  priceCap,
  onPriceCap,
  onReset,
  activeCount,
}: {
  filters: ListingFilters | null;
  subcategoryId?: number;
  onSubcategory(id: number | undefined): void;
  inStockOnly: boolean;
  onInStock(value: boolean): void;
  onSaleOnly: boolean;
  onOnSale(value: boolean): void;
  priceCap?: number;
  onPriceCap(value: number | undefined): void;
  onReset(): void;
  activeCount: number;
}) {
  const t = useT();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[color:var(--color-surface)] px-4 py-3">
        <h2 className="text-sm font-extrabold">{t("listing.refine")}</h2>
        {activeCount > 0 ? (
          <button type="button" onClick={onReset} className="text-[12px] font-bold text-[color:var(--color-action)] hover:underline">
            {t("common.clear")}
          </button>
        ) : null}
      </div>

      <FilterGroup title={t("listing.availability")}>
        <Checkbox label={t("listing.inStockOnly")} checked={inStockOnly} onChange={onInStock} />
        <Checkbox label={t("listing.onSale")} checked={onSaleOnly} onChange={onOnSale} />
      </FilterGroup>

      {filters && filters.price.max > filters.price.min ? (
        <FilterGroup title={t("listing.price")}>
          <input
            type="range"
            min={filters.price.min}
            max={filters.price.max}
            step={Math.max(1000, Math.round((filters.price.max - filters.price.min) / 100))}
            value={priceCap ?? filters.price.max}
            onChange={(event) => onPriceCap(Number(event.target.value))}
            className="w-full accent-[color:var(--color-action)]"
            aria-label={t("listing.maxPrice")}
          />
          <p className="flex justify-between text-[11px] text-[color:var(--color-ink-muted)]">
            <span>{formatMoney(filters.price.min)}</span>
            <span className="font-bold text-[color:var(--color-ink)]">
              up to {formatMoney(priceCap ?? filters.price.max)}
            </span>
          </p>
        </FilterGroup>
      ) : null}

      {filters && filters.subcategories.length > 0 ? (
        <FilterGroup title={t("listing.category")}>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              onClick={() => onSubcategory(undefined)}
              className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[color:var(--color-surface-alt)] ${
                subcategoryId === undefined ? "font-bold" : "text-[color:var(--color-ink-muted)]"
              }`}
            >
              All
            </button>
            {filters.subcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSubcategory(sub.id === subcategoryId ? undefined : sub.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[color:var(--color-surface-alt)] ${
                  subcategoryId === sub.id ? "font-bold text-[color:var(--color-action)]" : "text-[color:var(--color-ink-muted)]"
                }`}
              >
                <span className="clamp-1">{sub.name}</span>
                <span className="shrink-0 text-[11px] text-[color:var(--color-ink-faint)]">{sub.count}</span>
              </button>
            ))}
          </div>
        </FilterGroup>
      ) : null}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      <h3 className="mb-2 text-[13px] font-extrabold">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[color:var(--color-action)]"
      />
      <span>{label}</span>
    </label>
  );
}

export default ListingView;
