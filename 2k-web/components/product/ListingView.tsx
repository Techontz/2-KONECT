"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import shop, { type ProductQuery } from "@/lib/shop";
import { formatMoney } from "@/lib/format";
import type { Availability, ListingFilters, ProductCard as ProductCardModel } from "@/lib/types";
import { Button, EmptyState } from "@/components/ui/Primitives";
import { ProductGrid } from "./ProductShelf";

/**
 * The shared product-listing surface behind the shop, category, search and
 * deals pages: filters, a sort control, a result count and a paginated grid.
 *
 * One listing chrome everywhere, parameterised by its base query, rather than
 * four near-copies that drift apart.
 *
 * The availability filter is the first control on the page and the only one
 * that is always visible, because "is it here, or is it coming?" is the
 * question that changes the answer most on this marketplace.
 */

const SORTS = [
  { value: "relevance", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
] as const;

export function ListingView({
  baseQuery,
  heading,
  subheading,
  emptyMessage,
  /** Hide the availability toggle where the page itself already is one. */
  lockAvailability = false,
}: {
  baseQuery: ProductQuery;
  heading: string;
  subheading?: string;
  emptyMessage?: string;
  lockAvailability?: boolean;
}) {
  // What the shopper typed, carried into the sourcing desk if nothing matches.
  const requestHref = baseQuery.q
    ? `/request?name=${encodeURIComponent(baseQuery.q)}`
    : "/request";

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
  const [availability, setAvailability] = useState<Availability | undefined>(baseQuery.availability);
  const [origin, setOrigin] = useState<string | undefined>();
  const [verifiedOnly, setVerifiedOnly] = useState(Boolean(baseQuery.verified));
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [maxDays, setMaxDays] = useState<number | undefined>();
  const [priceCap, setPriceCap] = useState<number | undefined>();

  // Serialised so the effect re-runs when the caller changes category/search
  // without needing the object identity to be stable.
  const baseKey = JSON.stringify(baseQuery);

  useEffect(() => {
    setSubcategoryId(baseQuery.subcategory_id);
    setAvailability(baseQuery.availability);
    setVerifiedOnly(Boolean(baseQuery.verified));
    setOrigin(undefined);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  const query = useMemo<ProductQuery>(
    () => ({
      ...baseQuery,
      subcategory_id: subcategoryId,
      availability,
      source_country: origin,
      verified: verifiedOnly || undefined,
      max_days: maxDays,
      sort,
      in_stock: inStockOnly || undefined,
      on_sale: onSaleOnly || undefined,
      max_price: priceCap,
      per_page: 24,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, subcategoryId, availability, origin, verifiedOnly, maxDays, sort, inStockOnly, onSaleOnly, priceCap],
  );

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
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
    [query],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  function resetFilters() {
    setSubcategoryId(baseQuery.subcategory_id);
    setAvailability(baseQuery.availability);
    setOrigin(undefined);
    setVerifiedOnly(Boolean(baseQuery.verified));
    setInStockOnly(false);
    setOnSaleOnly(false);
    setMaxDays(undefined);
    setPriceCap(undefined);
    setSort("relevance");
  }

  const activeFilterCount =
    (subcategoryId && subcategoryId !== baseQuery.subcategory_id ? 1 : 0) +
    (availability !== baseQuery.availability ? 1 : 0) +
    (origin ? 1 : 0) +
    (verifiedOnly !== Boolean(baseQuery.verified) ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (maxDays ? 1 : 0) +
    (priceCap ? 1 : 0);

  const panel = (
    <FilterPanel
      filters={filters}
      lockAvailability={lockAvailability}
      availability={availability}
      origin={origin}
      setOrigin={setOrigin}
      subcategoryId={subcategoryId}
      setSubcategoryId={setSubcategoryId}
      verifiedOnly={verifiedOnly}
      setVerifiedOnly={setVerifiedOnly}
      inStockOnly={inStockOnly}
      setInStockOnly={setInStockOnly}
      onSaleOnly={onSaleOnly}
      setOnSaleOnly={setOnSaleOnly}
      maxDays={maxDays}
      setMaxDays={setMaxDays}
      priceCap={priceCap}
      setPriceCap={setPriceCap}
      onReset={resetFilters}
      activeFilterCount={activeFilterCount}
    />
  );

  // Nothing matched, and nothing is filtering it out: the controls cannot fix
  // this, so they are cleared away and the page becomes the sourcing offer.
  const barren = !loading && !failed && products.length === 0 && activeFilterCount === 0;

  if (barren) {
    return (
      <div className="shell py-4 pb-tabbar">
        <header className="mb-3">
          <h1 className="text-[22px] font-black tracking-[-0.02em] sm:text-[28px]">{heading}</h1>
        </header>

        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <EmptyState
            icon={<SearchIcon className="h-9 w-9" />}
            title="We don’t carry that yet"
            message={
              emptyMessage ??
              "Nothing in the catalogue matches. Tell us what you need and our sourcing team will find it, price it and bring it in."
            }
            action={
              <>
                <Link
                  href={requestHref}
                  className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-6 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
                >
                  Ask us to source it
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-6 text-sm font-bold"
                >
                  Browse everything
                </Link>
              </>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-4 pb-tabbar">
      <header className="mb-3">
        <h1 className="text-[22px] font-black tracking-[-0.02em] sm:text-[28px]">{heading}</h1>
        {subheading ? (
          <p className="mt-1 text-[14px] text-[color:var(--color-ink-muted)]">{subheading}</p>
        ) : null}
      </header>

      {/* The availability toggle sits above everything, on every width — it is
          the primary way to read this catalogue, not a sidebar checkbox. */}
      {!lockAvailability && filters?.availability ? (
        <AvailabilityToggle
          options={filters.availability}
          value={availability}
          onChange={(value) => setAvailability(value)}
          className="mb-3"
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+var(--nav-height)+8px)] max-h-[calc(100vh-140px)] overflow-y-auto rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            {panel}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[13px] text-[color:var(--color-ink-muted)]">
              {loading ? "Searching…" : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}`}
            </p>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[13px] font-bold lg:hidden"
            >
              <FilterIcon className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-[color:var(--color-brand)] px-1.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            <label className="flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-2.5 text-[13px]">
              <span className="hidden text-[color:var(--color-ink-muted)] sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as ProductQuery["sort"])}
                aria-label="Sort products"
                className="max-w-[150px] bg-transparent font-bold outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          {failed ? (
            <EmptyState
              title="We couldn’t load these products"
              message="Check your connection and try again."
              action={<Button onClick={() => void load(1, false)}>Try again</Button>}
            />
          ) : !loading && products.length === 0 ? (
            /* Nothing found is an opportunity, not a dead end: this is exactly
               the moment the sourcing desk is worth offering. */
            <EmptyState
              title="Nothing matched those filters"
              message={emptyMessage ?? "Try removing a filter — or ask us to source it for you."}
              action={
                <>
                  {activeFilterCount > 0 ? (
                    <Button variant="secondary" onClick={resetFilters}>Clear filters</Button>
                  ) : null}
                  <Link
                    href={requestHref}
                    className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-5 text-sm font-bold text-white"
                  >
                    Request this product
                  </Link>
                </>
              }
            />
          ) : (
            <>
              <ProductGrid products={products} loading={loading} />

              {hasMore ? (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="secondary"
                    size="lg"
                    loading={loadingMore}
                    onClick={() => void load(page + 1, true)}
                  >
                    {loadingMore ? "Loading" : "Show more"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ---- filters as a sheet on a phone ---- */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="fade-in absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
          <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--color-line)] bg-white px-4 py-3">
              <span className="text-[15px] font-black">Filters</span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="-mr-2 flex h-11 w-11 items-center justify-center"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">{panel}</div>

            <div className="sticky bottom-0 border-t border-[color:var(--color-line)] bg-white p-4">
              <Button size="lg" className="w-full" onClick={() => setFiltersOpen(false)}>
                Show {total.toLocaleString()} {total === 1 ? "product" : "products"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The local/imported switch.
 *
 * Three segments rather than a checkbox, because "all" is a real answer and
 * the counts tell a shopper what they are choosing between before they choose.
 */
function AvailabilityToggle({
  options,
  value,
  onChange,
  className = "",
}: {
  options: ListingFilters["availability"];
  value: Availability | undefined;
  onChange(value: Availability | undefined): void;
  className?: string;
}) {
  const total = options.reduce((sum, option) => sum + option.count, 0);

  const segments: { key: string; label: string; icon: string; count: number; value: Availability | undefined; tone?: Availability }[] = [
    { key: "all", label: "All", icon: "", count: total, value: undefined },
    ...options.map((option) => ({
      key: option.value,
      label: option.value === "local" ? "In Tanzania" : "From abroad",
      icon: option.value === "local" ? "🇹🇿" : "🌍",
      count: option.count,
      value: option.value,
      tone: option.value,
    })),
  ];

  return (
    <div
      role="group"
      aria-label="Where the product is"
      className={`grid grid-cols-3 gap-1.5 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-1.5 ${className}`}
    >
      {segments.map((segment) => {
        const active = value === segment.value;
        const tone =
          segment.tone === "local"
            ? "border-[color:var(--color-local-line)] bg-[color:var(--color-local-soft)] text-[color:var(--color-local)]"
            : segment.tone === "import"
              ? "border-[color:var(--color-import-line)] bg-[color:var(--color-import-soft)] text-[color:var(--color-import)]"
              : "border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]";

        return (
          <button
            key={segment.key}
            type="button"
            onClick={() => onChange(segment.value)}
            aria-pressed={active}
            disabled={segment.count === 0 && segment.value !== undefined}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border-2 px-2 py-1.5 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? tone : "border-transparent text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-alt)]"
            }`}
          >
            <span className="flex items-center gap-1 text-[12px] font-extrabold sm:text-[13px]">
              {segment.icon ? <span aria-hidden="true">{segment.icon}</span> : null}
              <span className="truncate">{segment.label}</span>
            </span>
            {/* Not `opacity`: fading the segment's own colour drops the count
                below the contrast floor on the tinted background. */}
            <span className="text-[10px] font-semibold text-[color:var(--color-ink-faint)]">
              {segment.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilterPanel({
  filters,
  lockAvailability,
  availability,
  origin,
  setOrigin,
  subcategoryId,
  setSubcategoryId,
  verifiedOnly,
  setVerifiedOnly,
  inStockOnly,
  setInStockOnly,
  onSaleOnly,
  setOnSaleOnly,
  maxDays,
  setMaxDays,
  priceCap,
  setPriceCap,
  onReset,
  activeFilterCount,
}: {
  filters: ListingFilters | null;
  lockAvailability: boolean;
  availability: Availability | undefined;
  origin: string | undefined;
  setOrigin(value: string | undefined): void;
  subcategoryId: number | undefined;
  setSubcategoryId(value: number | undefined): void;
  verifiedOnly: boolean;
  setVerifiedOnly(value: boolean): void;
  inStockOnly: boolean;
  setInStockOnly(value: boolean): void;
  onSaleOnly: boolean;
  setOnSaleOnly(value: boolean): void;
  maxDays: number | undefined;
  setMaxDays(value: number | undefined): void;
  priceCap: number | undefined;
  setPriceCap(value: number | undefined): void;
  onReset(): void;
  activeFilterCount: number;
}) {
  const priceMax = Math.ceil(filters?.price.max ?? 0);
  const priceMin = Math.floor(filters?.price.min ?? 0);
  const origins = filters?.origins ?? [];

  return (
    <div className="space-y-5">
      {activeFilterCount > 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="text-[12px] font-bold text-[color:var(--color-brand)] hover:underline"
        >
          Clear all filters ({activeFilterCount})
        </button>
      ) : null}

      {/* How soon it can be here. Reads as a promise rather than a number. */}
      <Group title="Delivery time">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Any", value: undefined },
            { label: "Within 3 days", value: 3 },
            { label: "Within 1 week", value: 7 },
            { label: "Within 2 weeks", value: 14 },
          ].map((option) => (
            <Chip
              key={option.label}
              active={maxDays === option.value}
              onClick={() => setMaxDays(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </Group>

      {origins.length > 1 ? (
        <Group title="Ships from">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!origin} onClick={() => setOrigin(undefined)}>Anywhere</Chip>
            {origins.map((country) => (
              <Chip
                key={country.code}
                active={origin === country.code}
                onClick={() => setOrigin(origin === country.code ? undefined : country.code)}
              >
                <span aria-hidden="true">{country.flag}</span> {country.name}
                <span className="text-[color:var(--color-ink-faint)]">{country.count}</span>
              </Chip>
            ))}
          </div>
        </Group>
      ) : null}

      <Group title="Trust">
        <Check checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified sellers only" />
        <Check checked={inStockOnly} onChange={setInStockOnly} label="In stock now" />
        <Check checked={onSaleOnly} onChange={setOnSaleOnly} label="On sale" />
      </Group>

      {priceMax > priceMin ? (
        <Group title="Max price">
          <input
            type="range"
            min={priceMin}
            max={priceMax}
            step={Math.max(1000, Math.round((priceMax - priceMin) / 100))}
            value={priceCap ?? priceMax}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPriceCap(next >= priceMax ? undefined : next);
            }}
            aria-label="Maximum price"
            className="w-full accent-[color:var(--color-brand)]"
          />
          <p className="mt-1 text-[12px] font-semibold">
            Up to {formatMoney(priceCap ?? priceMax)}
          </p>
        </Group>
      ) : null}

      {filters && filters.subcategories.length > 0 ? (
        <Group title="Type">
          <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            <li>
              <FilterRow
                active={subcategoryId === undefined}
                onClick={() => setSubcategoryId(undefined)}
                label="All types"
              />
            </li>
            {filters.subcategories.map((sub) => (
              <li key={sub.id}>
                <FilterRow
                  active={subcategoryId === sub.id}
                  onClick={() => setSubcategoryId(subcategoryId === sub.id ? undefined : sub.id)}
                  label={sub.name.trim()}
                  count={sub.count}
                />
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {/* On a phone the availability toggle lives at the top of the page, so
          it is not repeated here; on a locked page it is not offered at all. */}
      {lockAvailability ? null : (
        <p className="text-[11px] leading-relaxed text-[color:var(--color-ink-faint)]">
          Showing {availability === "import" ? "products sourced from abroad" : availability === "local" ? "products already in Tanzania" : "everything, wherever it is"}.
        </p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 text-[12px] font-semibold transition-colors ${
        active
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]"
          : "border-[color:var(--color-line-strong)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange(value: boolean): void;
  label: string;
}) {
  return (
    <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[color:var(--color-brand)]"
      />
      {label}
    </label>
  );
}

function FilterRow({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick(): void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[34px] w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-[13px] transition-colors ${
        active
          ? "bg-[color:var(--color-brand-50)] font-bold text-[color:var(--color-brand)]"
          : "hover:bg-[color:var(--color-surface-alt)]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="shrink-0 text-[11px] text-[color:var(--color-ink-faint)]">{count}</span>
      ) : null}
    </button>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

function FilterIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
