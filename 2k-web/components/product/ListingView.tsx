"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { type ProductQuery } from "@/lib/shop";
import { usePagedListing } from "@/lib/queries";
import type { Availability, ListingFilters, ProductCard as ProductCardModel } from "@/lib/types";
import { boolParam, currentSearchParams, numberParam, writeSearchParams } from "@/lib/urlState";
import { Button, EmptyState, Skeleton } from "@/components/ui/Primitives";
import { PriceFilter } from "./PriceFilter";
import { ProductGrid } from "./ProductShelf";

/**
 * The shared product-listing surface behind the shop, category, search and
 * deals pages: filters, a sort control, a result count and a paginated grid.
 *
 * One listing chrome everywhere, parameterised by its base query, rather than
 * four near-copies that drift apart.
 *
 * Results are cached against the query that produced them, so going back to a
 * grid — from a product, or by flipping a tab back to one already seen —
 * repaints the products immediately and checks for changes behind them.
 *
 * The availability filter is the first control on the page and the only one
 * that is always visible, because "is it here, or is it coming?" is the
 * question that changes the answer most on this marketplace.
 *
 * ---- filters live in the URL ----
 *
 * Every control writes itself into the query string, so a filtered grid is a
 * place rather than a mood: it survives a refresh, it can be sent to someone,
 * and coming back from a product lands on the same twelve results rather than
 * on the unfiltered catalogue. The write goes through the browser's own
 * `replaceState` (see lib/urlState) so it costs no navigation.
 *
 * `baseQuery` stays the page's own identity — the category, the search term,
 * the seller. When it changes the filters are re-read from the address bar,
 * which is what makes both directions agree: state writes the URL, and a
 * navigation lets the URL write the state.
 */

const SORTS = [
  { value: "relevance", key: "listing.sortRecommended" },
  { value: "newest", key: "listing.sortNewest" },
  { value: "price_asc", key: "listing.sortPriceAsc" },
  { value: "price_desc", key: "listing.sortPriceDesc" },
  { value: "rating", key: "listing.sortRating" },
  { value: "discount", key: "listing.sortDiscount" },
] as const;

/** Everything the panel owns, read out of a query string. */
function readFilters(params: URLSearchParams, base: ProductQuery) {
  const sort = params.get("sort") as ProductQuery["sort"] | null;

  return {
    sort: SORTS.some((option) => option.value === sort)
      ? (sort as ProductQuery["sort"])
      : base.sort ?? "relevance",
    subcategoryId: numberParam(params, "type") ?? base.subcategory_id,
    availability: (["local", "import"] as const).find((value) => value === params.get("availability"))
      ?? base.availability,
    origin: params.get("origin") ?? base.source_country,
    verifiedOnly: boolParam(params, "verified") ?? Boolean(base.verified),
    inStockOnly: boolParam(params, "in_stock") ?? false,
    onSaleOnly: boolParam(params, "on_sale") ?? false,
    maxDays: numberParam(params, "max_days") ?? base.max_days,
    priceCap: numberParam(params, "max_price"),
  };
}

interface ListingProps {
  baseQuery: ProductQuery;
  heading: string;
  emptyMessage?: string;
}

/**
 * Reading the query string is what makes the filters shareable, and any
 * component that does it has to sit inside a Suspense boundary or the route
 * cannot be prerendered. The boundary lives here rather than in each of the
 * six pages that render a listing, so a new one cannot forget it — the build
 * fails on that, and it failed on exactly that when this was left to callers.
 *
 * The pages that already have their own boundary keep it; nesting is free.
 */
export function ListingView(props: ListingProps) {
  return (
    <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
      <Listing {...props} />
    </Suspense>
  );
}

function Listing({ baseQuery, heading, emptyMessage }: ListingProps) {
  const t = useT();

  // The params as they were when this listing mounted, for the initial state.
  // Read through the hook rather than off `window` so the first client render
  // already has them.
  const searchParams = useSearchParams();
  const seed = useRef<ReturnType<typeof readFilters> | null>(null);
  if (seed.current === null) {
    seed.current = readFilters(new URLSearchParams(searchParams.toString()), baseQuery);
  }

  // What the shopper typed, carried into the sourcing desk if nothing matches.
  const requestHref = baseQuery.q
    ? `/request?name=${encodeURIComponent(baseQuery.q)}`
    : "/request";

  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sort, setSort] = useState<ProductQuery["sort"]>(seed.current.sort);
  const [subcategoryId, setSubcategoryId] = useState(seed.current.subcategoryId);
  const [availability, setAvailability] = useState<Availability | undefined>(seed.current.availability);
  const [origin, setOrigin] = useState<string | undefined>(seed.current.origin);
  const [verifiedOnly, setVerifiedOnly] = useState(seed.current.verifiedOnly);
  const [inStockOnly, setInStockOnly] = useState(seed.current.inStockOnly);
  const [onSaleOnly, setOnSaleOnly] = useState(seed.current.onSaleOnly);
  const [maxDays, setMaxDays] = useState(seed.current.maxDays);
  const [priceCap, setPriceCap] = useState(seed.current.priceCap);

  // Serialised so the effect re-runs when the caller changes category/search
  // without needing the object identity to be stable.
  const baseKey = JSON.stringify(baseQuery);
  const lastBaseKey = useRef(baseKey);

  // A new page: re-read the filters from the address bar. Reading the URL
  // rather than resetting to `baseQuery` is what lets a link arrive with
  // filters already applied, and stops a filter the shopper has navigated away
  // from being resurrected from stale state.
  useEffect(() => {
    if (lastBaseKey.current === baseKey) return;
    lastBaseKey.current = baseKey;

    const next = readFilters(currentSearchParams(), JSON.parse(baseKey) as ProductQuery);
    setSort(next.sort);
    setSubcategoryId(next.subcategoryId);
    setAvailability(next.availability);
    setOrigin(next.origin);
    setVerifiedOnly(next.verifiedOnly);
    setInStockOnly(next.inStockOnly);
    setOnSaleOnly(next.onSaleOnly);
    setMaxDays(next.maxDays);
    setPriceCap(next.priceCap);
  }, [baseKey]);

  // ...and the other direction.
  //
  // A filter is written under its own name whenever it is switched on. The
  // three that are *not* are the ones some route states another way:
  // `/shop/local` is already an availability, `/shop/abroad?country=CN` is
  // already an origin, `/category?subcategory=33` is already a type. Those are
  // suppressed when they merely restate the page, so the URL does not say the
  // same thing twice.
  //
  // `verified`, `max_days` and `sort` are deliberately not treated that way
  // even though they also reach `baseQuery`: `/shop` reads them from these
  // exact keys, so suppressing them as "already in the base" would delete the
  // page's own address — a refresh then landed on the unfiltered catalogue.
  useEffect(() => {
    writeSearchParams({
      sort: sort && sort !== "relevance" ? sort : undefined,
      verified: verifiedOnly || undefined,
      max_days: maxDays,
      max_price: priceCap,
      in_stock: inStockOnly || undefined,
      on_sale: onSaleOnly || undefined,
      type: subcategoryId !== baseQuery.subcategory_id ? subcategoryId : undefined,
      availability: availability !== baseQuery.availability ? availability : undefined,
      origin: origin !== baseQuery.source_country ? origin : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, sort, subcategoryId, availability, origin, verifiedOnly, inStockOnly, onSaleOnly, maxDays, priceCap]);

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

  const listing = usePagedListing(query);

  const products: ProductCardModel[] = listing.data?.products ?? [];
  const filters: ListingFilters | null = listing.data?.filters ?? null;
  const total = listing.data?.meta.total ?? 0;
  const hasMore = listing.data?.meta.has_more ?? false;
  const loading = listing.loading;
  const failed = listing.error;

  async function showMore() {
    setLoadingMore(true);
    try {
      await listing.loadMore();
    } finally {
      setLoadingMore(false);
    }
  }

  // "Clear" returns to whatever the page itself is about, not to an empty
  // query: clearing on /shop/abroad?country=CN must leave China selected,
  // because that is the page, not a filter the shopper added.
  function resetFilters() {
    setSubcategoryId(baseQuery.subcategory_id);
    setAvailability(baseQuery.availability);
    setOrigin(baseQuery.source_country);
    setVerifiedOnly(Boolean(baseQuery.verified));
    setInStockOnly(false);
    setOnSaleOnly(false);
    setMaxDays(baseQuery.max_days);
    setPriceCap(undefined);
    setSort(baseQuery.sort ?? "relevance");
  }

  const activeFilterCount =
    (subcategoryId && subcategoryId !== baseQuery.subcategory_id ? 1 : 0) +
    (availability !== baseQuery.availability ? 1 : 0) +
    (origin !== baseQuery.source_country ? 1 : 0) +
    (verifiedOnly !== Boolean(baseQuery.verified) ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (maxDays !== baseQuery.max_days ? 1 : 0) +
    (priceCap ? 1 : 0);

  const countLabel = total === 1 ? t("listing.productCountOne") : t("listing.productCount", { count: total.toLocaleString() });

  const panel = (
    <FilterPanel
      filters={filters}
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
          <h1 className="text-[17px] font-extrabold tracking-[-0.025em] text-[color:var(--color-brand)] sm:text-[20px]">{heading}</h1>
        </header>

        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <EmptyState
            icon={<SearchIcon className="h-9 w-9" />}
            title={t("listing.dontCarry")}
            message={emptyMessage ?? t("listing.dontCarryHint")}
            action={
              <>
                <Link
                  href={requestHref}
                  className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-6 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
                >
                  {t("listing.askToSource")}
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-6 text-sm font-bold"
                >
                  {t("listing.browseEverything")}
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
      {/* One compact line, and nothing else.
          A listing page's job is to get to the grid. The page still needs
          exactly one h1 for assistive technology and for search, but it does
          not need a paragraph explaining the marketplace — the tabs directly
          beneath say which half of it you are looking at, and every card
          repeats the answer. */}
      <h1 className="mb-2.5 text-[17px] font-extrabold tracking-[-0.025em] text-[color:var(--color-brand)] sm:text-[20px]">
        {heading}
      </h1>

      {/* The tabs sit above everything, on every width and on every listing. */}
      {filters?.availability ? (
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
              {loading ? t("listing.searching") : countLabel}
            </p>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[13px] font-bold lg:hidden"
            >
              <FilterIcon className="h-4 w-4" />
              {t("filters.open")}
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-[color:var(--color-brand)] px-1.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            <label className="flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-2.5 text-[13px]">
              <span className="hidden text-[color:var(--color-ink-muted)] sm:inline">{t("listing.sort")}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as ProductQuery["sort"])}
                aria-label={t("listing.sortAria")}
                className="max-w-[150px] bg-transparent font-bold outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>{t(option.key)}</option>
                ))}
              </select>
            </label>
          </div>

          {failed ? (
            <EmptyState
              title={t("listing.loadFailed")}
              message={t("listing.loadFailedHint")}
              action={<Button onClick={listing.refresh}>{t("common.retry")}</Button>}
            />
          ) : !loading && products.length === 0 ? (
            /* Nothing found is an opportunity, not a dead end: this is exactly
               the moment the sourcing desk is worth offering. */
            <EmptyState
              title={t("listing.nothingMatched")}
              message={emptyMessage ?? t("listing.nothingMatchedHint")}
              action={
                <>
                  {activeFilterCount > 0 ? (
                    <Button variant="secondary" onClick={resetFilters}>{t("listing.clearFilters")}</Button>
                  ) : null}
                  <Link
                    href={requestHref}
                    className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-5 text-sm font-bold text-white"
                  >
                    {t("listing.requestProduct")}
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
                    onClick={() => void showMore()}
                  >
                    {loadingMore ? t("listing.loadingMore") : t("listing.showMoreShort")}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ---- filters as a sheet on a phone ---- */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={t("filters.title")}>
          <div className="fade-in absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
          <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--color-line)] bg-white px-4 py-3">
              <span className="text-[15px] font-black">{t("filters.title")}</span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label={t("filters.close")}
                className="-mr-2 flex h-11 w-11 items-center justify-center"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">{panel}</div>

            <div className="sticky bottom-0 border-t border-[color:var(--color-line)] bg-white p-4">
              <Button size="lg" className="w-full" onClick={() => setFiltersOpen(false)}>
                {total === 1 ? t("filters.applyOne") : t("filters.apply", { count: total.toLocaleString() })}
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
  const t = useT();
  const total = options.reduce((sum, option) => sum + option.count, 0);

  const segments: { key: string; label: string; icon: string; count: number; value: Availability | undefined; tone?: Availability }[] = [
    { key: "all", label: t("filters.all"), icon: "", count: total, value: undefined },
    ...options.map((option) => ({
      key: option.value,
      label: option.value === "local" ? t("filters.inCountry", { country: BRAND.country }) : t("filters.fromAbroad"),
      icon: option.value === "local" ? "🇹🇿" : "🌍",
      count: option.count,
      value: option.value,
      tone: option.value,
    })),
  ];

  return (
    <div
      role="group"
      aria-label={t("filters.whereIsIt")}
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
  const t = useT();

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
          {t("filters.clearAllCount", { count: activeFilterCount })}
        </button>
      ) : null}

      {/* Price leads the panel. It is the filter shoppers reach for first, and
          the one the old single slider served worst. */}
      {priceMax > priceMin ? (
        <Group title={t("filters.maxPrice")}>
          <PriceFilter min={priceMin} max={priceMax} value={priceCap} onChange={setPriceCap} />
        </Group>
      ) : null}

      {/* How soon it can be here. Reads as a promise rather than a number. */}
      <Group title={t("filters.deliveryTime")}>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: t("filters.anyTime"), value: undefined },
            { label: t("filters.within3Days"), value: 3 },
            { label: t("filters.withinWeek"), value: 7 },
            { label: t("filters.withinTwoWeeks"), value: 14 },
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
        <Group title={t("filters.shipsFrom")}>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!origin} onClick={() => setOrigin(undefined)}>{t("filters.anywhere")}</Chip>
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

      <Group title={t("filters.trust")}>
        <Check checked={verifiedOnly} onChange={setVerifiedOnly} label={t("filters.verifiedOnly")} />
        <Check checked={inStockOnly} onChange={setInStockOnly} label={t("filters.inStockNow")} />
        <Check checked={onSaleOnly} onChange={setOnSaleOnly} label={t("filters.onSale")} />
      </Group>

      {filters && filters.subcategories.length > 0 ? (
        <Group title={t("filters.type")}>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
            <li>
              <FilterRow
                active={subcategoryId === undefined}
                onClick={() => setSubcategoryId(undefined)}
                label={t("filters.allTypes")}
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

      {/* A one-line reminder of which tab is active, for anyone who has
          scrolled the filter panel far enough that the tabs are off screen. */}
      <p className="text-[11px] leading-relaxed text-[color:var(--color-ink-faint)]">
        {availability === "import"
          ? t("filters.showingImport")
          : availability === "local"
            ? t("filters.showingLocal", { country: BRAND.country })
            : t("filters.showingAll")}
      </p>
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
