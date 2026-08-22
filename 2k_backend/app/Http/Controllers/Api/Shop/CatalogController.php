<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductCardResource;
use App\Http\Resources\ProductDetailResource;
use App\Models\Banner;
use App\Models\Category;
use App\Models\Product;
use App\Models\Subcategory;
use App\Support\CatalogCache;
use App\Support\Media;
use App\Support\Sourcing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Public storefront catalogue.
 *
 * Everything here is browsable without authentication — a visitor can reach
 * the whole catalogue before being asked to log in. Every endpoint is
 * paginated and every listing eager-loads its relations, so no page can
 * degrade into an N+1 sweep across 2,857 products.
 */
class CatalogController extends Controller
{
    private const MAX_PER_PAGE = 60;

    /* ---------------------------------------------------------------- */
    /* Home feed                                                        */
    /* ---------------------------------------------------------------- */

    /**
     * Everything the homepage needs in one request, so the landing view does
     * not fan out into a dozen round trips.
     */
    public function home(Request $request)
    {
        $shelfSize = 12;

        $payload = CatalogCache::remember('home', 300, function () use ($shelfSize) {
            $banners = $this->bannerGroups();

            return [
                // `banners` is kept for the Flutter app, which reads the flat
                // list; the website uses the grouped keys below.
                'banners'     => $banners['hero'],
                'hero'        => $banners['hero'],
                'hero_side'   => $banners['hero_side'],
                'promos'      => $banners['promos'],
                'categories'  => $this->categoryRail(),
                'collections' => $this->categoryCollections(),
                'shelves'     => $this->homeShelves($shelfSize),

                // Two small facets the homepage used to collect by issuing
                // five extra listing requests of its own — four of them asking
                // for a single row purely to read the paginator's total. They
                // are answered here, inside the same cached payload, because
                // they describe the same catalogue. Additive keys: every
                // existing consumer, the Flutter app included, is unaffected.
                'origins'          => $this->originFacet(),
                'delivery_windows' => $this->deliveryWindows(),

                // The two ways to buy, each with its own row, because the
                // difference between them is the product.
                'local' => ProductCardResource::collection(
                    $this->baseListing()->local()->where('stock', '>', 0)->limit($shelfSize)->get()
                )->resolve(),
                'imports' => ProductCardResource::collection(
                    $this->baseListing()->imported()->limit($shelfSize)->get()
                )->resolve(),
                // Listings from sellers an administrator has actually vetted.
                'verified' => ProductCardResource::collection(
                    $this->baseListing()
                        ->whereHas('vendor', fn ($v) => $v->where('is_verified', true))
                        ->where('stock', '>', 0)
                        ->limit($shelfSize)
                        ->get()
                )->resolve(),
                'deals'      => ProductCardResource::collection(
                    $this->baseListing()
                        ->whereNotNull('old_price')
                        ->whereColumn('old_price', '>', 'new_price')
                        ->where('stock', '>', 0)
                        // `reorder()` first: the base query sorts by newest, and
                        // without clearing it the id ordering wins and the
                        // "biggest savings" shelf is not sorted by saving at all.
                        ->reorder()
                        ->orderByRaw('((old_price - new_price) / old_price) DESC')
                        ->limit($shelfSize)
                        ->get()
                )->resolve(),
            ];
        });

        return response()->json($payload);
    }

    /**
     * Everything the website's XML sitemap needs, and nothing else.
     *
     * Ids and timestamps only — no names, prices, images or relations. The
     * sitemap needs a URL and a `lastmod`, and shipping the catalogue payload
     * to build one would be several megabytes for a few hundred kilobytes of
     * XML.
     *
     * It exists because the alternative is worse: the listing endpoint caps at
     * sixty rows a page, so a crawlable sitemap of 2,858 products would mean
     * forty-eight paginated round trips against an origin whose TTFB is around
     * three seconds. This is four flat queries, cached, and versioned with the
     * rest of the catalogue so a new product appears in the sitemap on the next
     * request rather than at the end of a TTL.
     *
     * Only what should actually be indexed: a vendor with nothing in stock is
     * an empty storefront, and a subcategory with no products is a dead grid.
     */
    public function sitemap()
    {
        $payload = CatalogCache::remember('sitemap', 1800, function () {
            return [
                'products' => DB::table('products')
                    ->select('id', 'updated_at')
                    ->orderBy('id')
                    ->get()
                    ->map(fn ($row) => [
                        'id'           => (int) $row->id,
                        'updated_at'   => $row->updated_at,
                    ])
                    ->all(),

                'categories' => DB::table('categories')
                    ->select('id', 'updated_at')
                    ->orderBy('id')
                    ->get()
                    ->map(fn ($row) => ['id' => (int) $row->id, 'updated_at' => $row->updated_at])
                    ->all(),

                // Subcategories that actually have something behind them. One
                // with no products is a page that would be crawled, found
                // empty, and counted against the site.
                'subcategories' => DB::table('subcategories')
                    ->select('subcategories.id', 'subcategories.category_id', 'subcategories.updated_at')
                    ->whereExists(fn ($q) => $q->selectRaw('1')->from('products')
                        ->whereColumn('products.subcategory_id', 'subcategories.id'))
                    ->orderBy('subcategories.id')
                    ->get()
                    ->map(fn ($row) => [
                        'id'          => (int) $row->id,
                        'category_id' => (int) $row->category_id,
                        'updated_at'  => $row->updated_at,
                    ])
                    ->all(),

                'vendors' => DB::table('vendors')
                    ->select('vendors.id', 'vendors.updated_at')
                    ->where('vendors.is_approved', true)
                    ->whereExists(fn ($q) => $q->selectRaw('1')->from('products')
                        ->whereColumn('products.vendor_id', 'vendors.id')
                        ->where('products.stock', '>', 0))
                    ->orderBy('vendors.id')
                    ->get()
                    ->map(fn ($row) => ['id' => (int) $row->id, 'updated_at' => $row->updated_at])
                    ->all(),
            ];
        });

        return response()->json($payload);
    }

    /* ---------------------------------------------------------------- */
    /* Listing                                                          */
    /* ---------------------------------------------------------------- */

    /**
     * The single listing endpoint behind category pages, subcategory pages,
     * search results, deals and "view all" shelves.
     *
     * Filters: category_id, subcategory_id, vendor_id, q, min_price,
     * max_price, in_stock, on_sale, rating.
     * Sorts: relevance (search only), newest, price_asc, price_desc,
     * rating, discount.
     */
    public function products(Request $request)
    {
        $validated = $request->validate([
            'category_id'    => 'nullable|integer|exists:categories,id',
            'subcategory_id' => 'nullable|integer|exists:subcategories,id',
            'vendor_id'      => 'nullable|integer|exists:vendors,id',
            'q'              => 'nullable|string|max:120',
            'min_price'      => 'nullable|numeric|min:0',
            'max_price'      => 'nullable|numeric|min:0',
            'in_stock'       => 'nullable|boolean',
            'on_sale'        => 'nullable|boolean',
            // The defining filter: is it here, or is it coming?
            'availability'   => 'nullable|string|in:local,import',
            'source_country' => 'nullable|string|size:2',
            'verified'       => 'nullable|boolean',
            'max_days'       => 'nullable|integer|min:1|max:120',
            'rating'         => 'nullable|numeric|min:0|max:5',
            'sort'           => 'nullable|string|in:newest,price_asc,price_desc,rating,discount,relevance',
            'per_page'       => 'nullable|integer|min:1|max:' . self::MAX_PER_PAGE,
            'page'           => 'nullable|integer|min:1',
        ]);

        $query = $this->baseListing();
        $this->applyFilters($query, $validated);
        $this->applySort($query, $validated['sort'] ?? null, ! empty($validated['q']));

        $paginator = $query->paginate(
            $validated['per_page'] ?? 24
        )->withQueryString();

        return response()->json([
            'products' => ProductCardResource::collection($paginator->items())->resolve(),
            'meta'     => [
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'has_more'     => $paginator->hasMorePages(),
            ],
            'filters' => $this->availableFilters($validated),
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* Detail                                                           */
    /* ---------------------------------------------------------------- */

    public function product(int $id)
    {
        $product = Product::with([
            'images',
            'attributeValues.attribute',
            'category',
            'subcategory',
            'vendor',
            'reviews.user',
            'offers.vendor',
            // Optional extras. Loaded here, nested, so the whole option matrix
            // costs three queries for the page rather than one per variant and
            // two more per option row.
            'priceTiers',
            'variants.options.attribute',
            'variants.options.attributeValue',
        ])->find($id);

        if (! $product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        return response()->json([
            'product' => (new ProductDetailResource($product))->resolve(),
            'related' => ProductCardResource::collection(
                $this->baseListing()
                    ->where('id', '!=', $product->id)
                    ->when(
                        $product->subcategory_id,
                        fn ($q) => $q->where('subcategory_id', $product->subcategory_id),
                        fn ($q) => $q->where('category_id', $product->category_id)
                    )
                    ->limit(12)
                    ->get()
            )->resolve(),
            'from_vendor' => ProductCardResource::collection(
                $this->baseListing()
                    ->where('id', '!=', $product->id)
                    ->where('vendor_id', $product->vendor_id)
                    ->limit(12)
                    ->get()
            )->resolve(),
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* Search                                                           */
    /* ---------------------------------------------------------------- */

    /**
     * Type-ahead suggestions for the header search field. Intentionally light:
     * a handful of product names plus the categories they sit in.
     */
    public function suggest(Request $request)
    {
        $term = trim((string) $request->query('q', ''));

        if (mb_strlen($term) < 2) {
            return response()->json(['products' => [], 'categories' => []]);
        }

        $like = '%' . $term . '%';

        $products = Product::query()
            ->select('id', 'name', 'new_price')
            ->where('name', 'like', $like)
            ->orderByRaw($this->lengthOf('name'))
            ->limit(8)
            ->get()
            ->map(fn ($p) => [
                'id'    => $p->id,
                'name'  => $p->name,
                'price' => (float) $p->new_price,
            ]);

        $categories = Category::query()
            ->select('id', 'name')
            ->where('name', 'like', $like)
            ->limit(4)
            ->get();

        return response()->json([
            'products'   => $products,
            'categories' => $categories,
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* Taxonomy                                                         */
    /* ---------------------------------------------------------------- */

    /** The full category tree, used by the nav bar and the mega menu. */
    public function categories()
    {
        $categories = CatalogCache::remember('categories', 600, function () {
            return Category::query()
                ->with(['subcategories' => fn ($q) => $q->select('id', 'category_id', 'name', 'icon', 'icon_image')])
                ->withCount('products')
                ->orderBy('name')
                ->get()
                ->map(fn ($category) => [
                    'id'            => $category->id,
                    'name'          => $category->name,
                    'icon'          => $category->icon,
                    'image'         => Media::url($category->icon_image),
                    'product_count' => $category->products_count,
                    'subcategories' => $category->subcategories->map(fn ($sub) => [
                        'id'    => $sub->id,
                        'name'  => $sub->name,
                        'icon'  => $sub->icon,
                        'image' => Media::url($sub->icon_image),
                    ])->values(),
                ])
                ->values()
                ->all();
        });

        return response()->json(['categories' => $categories]);
    }

    /** A single category with its subcategories and a first page of products. */
    public function category(int $id, Request $request)
    {
        // The one catalogue read that was not cached, and the most expensive
        // per visit: six product shelves plus a count for every subcategory.
        // Versioned like the rest, so an administrator's edit still lands on
        // the next request.
        $payload = CatalogCache::remember('category.' . $id, 600, function () use ($id) {
            return $this->buildCategoryPage($id);
        });

        if ($payload === null) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        return response()->json($payload);
    }

    /**
     * @return array<string, mixed>|null  null when the category does not exist
     */
    private function buildCategoryPage(int $id): ?array
    {
        // `withCount` on the relation, rather than a `Product::count()` inside
        // the map below: that ran one COUNT query per subcategory, so a
        // fourteen-subcategory category paid fourteen round trips to put a
        // number under each tile.
        $category = Category::with(['subcategories' => fn ($q) => $q->withCount('products')])->find($id);

        if (! $category) {
            return null;
        }

        return ([
            'category' => [
                'id'    => $category->id,
                'name'  => $category->name,
                'image' => Media::url($category->icon_image),
            ],
            'subcategories' => $category->subcategories->map(fn ($sub) => [
                'id'    => $sub->id,
                'name'  => $sub->name,
                'image' => Media::url($sub->icon_image),
                'product_count' => (int) $sub->products_count,
            ])->values(),
            'shelves' => $category->subcategories
                ->take(6)
                ->map(fn ($sub) => [
                    'id'       => $sub->id,
                    'title'    => $sub->name,
                    'products' => ProductCardResource::collection(
                        $this->baseListing()->where('subcategory_id', $sub->id)->limit(12)->get()
                    )->resolve(),
                ])
                ->filter(fn ($shelf) => count($shelf['products']) > 0)
                ->values()
                ->all(),
        ]);
    }

    /* ---------------------------------------------------------------- */
    /* Internals                                                        */
    /* ---------------------------------------------------------------- */

    /**
     * Base query for every listing: relations the card needs, plus aggregated
     * review columns so ratings never cost a query per row.
     */
    private function baseListing(): Builder
    {
        return Product::query()
            ->with(['images', 'category', 'subcategory', 'vendor'])
            // The model auto-eager-loads `attributeValues.attribute` for every
            // query in the application. A product card never renders an
            // attribute, so on a listing page that is two extra queries and a
            // few hundred unused rows per request. Dropped here only — the
            // model default still stands for the endpoints that do need it.
            ->without('attributeValues')
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            // Two booleans for the card, as EXISTS subqueries on the row that
            // is already being fetched. Eager-loading the tiers and variants
            // themselves would drag a matrix per product into a payload that
            // renders neither.
            ->withExists([
                'priceTiers as price_tiers_exists',
                'variants as variants_exists' => fn ($q) => $q->where('is_active', true),
            ])
            // For a product that sells by combination the parent row is not
            // the commercial unit, so the card cannot read price and stock
            // from it — an iPhone whose four variants hold seventeen units
            // between them would otherwise render "Out of stock" because the
            // parent row says zero. These are correlated subqueries on the row
            // already being fetched, so the whole grid still costs one query.
            ->withSum(['variants as variants_stock' => fn ($q) => $q->where('is_active', true)], 'stock')
            ->withMin(['variants as variants_min_price' => fn ($q) => $q->where('is_active', true)], 'price')
            ->withMax(['variants as variants_max_price' => fn ($q) => $q->where('is_active', true)], 'price')
            // MIN/MAX skip nulls, so a variant that inherits the product's
            // price is invisible to them; this counts those so the range can
            // include the parent price when one of them does.
            ->withCount(['variants as variants_inheriting' => fn ($q) => $q->where('is_active', true)->whereNull('price')])
            ->latest('id');
    }

    private function applyFilters(Builder $query, array $f): void
    {
        // Query-string values arrive as strings. MySQL coerces a string to a
        // number when it is compared to one; SQLite does not — it sorts every
        // text value above every integer, so `14 <= '3'` is true there and a
        // numeric filter silently matches everything. Cast at the boundary.
        foreach (['min_price', 'max_price', 'rating'] as $key) {
            if (isset($f[$key]) && $f[$key] !== '') {
                $f[$key] = (float) $f[$key];
            }
        }

        foreach (['category_id', 'subcategory_id', 'vendor_id', 'max_days'] as $key) {
            if (isset($f[$key]) && $f[$key] !== '') {
                $f[$key] = (int) $f[$key];
            }
        }

        $query
            ->when($f['category_id'] ?? null, fn ($q, $v) => $q->where('category_id', $v))
            ->when($f['subcategory_id'] ?? null, fn ($q, $v) => $q->where('subcategory_id', $v))
            ->when($f['vendor_id'] ?? null, fn ($q, $v) => $q->where('vendor_id', $v))
            ->when($f['min_price'] ?? null, fn ($q, $v) => $q->where('new_price', '>=', $v))
            ->when($f['max_price'] ?? null, fn ($q, $v) => $q->where('new_price', '<=', $v))
            ->when(! empty($f['in_stock']), fn ($q) => $q->where('stock', '>', 0))
            ->when(! empty($f['on_sale']), fn ($q) => $q
                ->whereNotNull('old_price')
                ->whereColumn('old_price', '>', 'new_price'))
            ->when($f['rating'] ?? null, fn ($q, $v) => $q->having('reviews_avg_rating', '>=', $v))
            ->when($f['availability'] ?? null, fn ($q, $v) => $q->where('availability', $v))
            ->when($f['source_country'] ?? null, fn ($q, $v) => $q->where('source_country', strtoupper($v)))
            ->when(! empty($f['verified']), fn ($q) => $q
                ->whereHas('vendor', fn ($v) => $v->where('is_verified', true)))
            // "I need it within N days": compare against the promised upper
            // bound, falling back to the type default when a listing has not
            // set one, so an unconfigured product is not silently excluded.
            ->when($f['max_days'] ?? null, fn ($q, $v) => $q->whereRaw(
                'COALESCE(lead_time_max_days, CASE WHEN availability = ? THEN ? ELSE ? END) <= ?',
                [Sourcing::IMPORT, Sourcing::DEFAULT_LEAD_TIME[Sourcing::IMPORT]['max'], Sourcing::DEFAULT_LEAD_TIME[Sourcing::LOCAL]['max'], $v],
            ));

        // Keep the search terms grouped: without the closure the OR would
        // escape the filters above and match the whole catalogue.
        if (! empty($f['q'])) {
            $term = '%' . $f['q'] . '%';
            $query->where(function (Builder $q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('description', 'like', $term);
            });
        }
    }

    private function applySort(Builder $query, ?string $sort, bool $isSearch): void
    {
        // Ordering is applied on top of the base query's `latest('id')`, so
        // reorder rather than append.
        $query->reorder();

        match ($sort) {
            'price_asc'  => $query->orderBy('new_price'),
            'price_desc' => $query->orderByDesc('new_price'),
            'rating'     => $query->orderByDesc('reviews_avg_rating')->orderByDesc('id'),
            'discount'   => $query
                ->orderByRaw('CASE WHEN old_price > new_price THEN ((old_price - new_price) / old_price) ELSE 0 END DESC')
                ->orderByDesc('id'),
            'newest'     => $query->orderByDesc('id'),
            default      => $isSearch
                // Relevance: shorter names match the term more tightly, and
                // in-stock items should never rank below sold-out ones.
                ? $query->orderByRaw('(stock > 0) DESC')
                        ->orderByRaw($this->lengthOf('name'))
                        ->orderByDesc('id')
                : $query->orderByDesc('id'),
        };
    }

    /**
     * String-length expression for the active driver.
     *
     * MySQL's CHAR_LENGTH does not exist in SQLite, which the test suite runs
     * on, so the relevance ordering has to ask for the right function.
     */
    private function lengthOf(string $column): string
    {
        return DB::getDriverName() === 'sqlite'
            ? "LENGTH({$column})"
            : "CHAR_LENGTH({$column})";
    }

    /** Facet data so the PLP sidebar reflects what is actually available. */
    private function availableFilters(array $f): array
    {
        // `withOnly([])` clears the model's automatic eager loads. These
        // queries return grouped aggregates rather than products, so without
        // it Laravel hydrates a phantom row and issues five relation queries
        // against `product_id in (0)` for every facet computed.
        $scope = Product::query()->withOnly([]);
        $this->applyFilters($scope, array_diff_key($f, ['min_price' => 1, 'max_price' => 1]));

        $range = (clone $scope)
            ->selectRaw('MIN(new_price) AS min_price, MAX(new_price) AS max_price')
            ->first();

        // Availability counts ignore the availability filter itself, so the
        // shopper can always see how many sit on the other side of the toggle.
        $availabilityScope = Product::query()->withOnly([]);
        $this->applyFilters($availabilityScope, array_diff_key($f, [
            'min_price' => 1, 'max_price' => 1, 'availability' => 1,
        ]));

        $byAvailability = (clone $availabilityScope)
            ->select('availability', DB::raw('COUNT(*) AS total'))
            ->groupBy('availability')
            ->pluck('total', 'availability');

        return [
            'price' => [
                'min' => (float) ($range->min_price ?? 0),
                'max' => (float) ($range->max_price ?? 0),
            ],
            'availability' => [
                [
                    'value' => Sourcing::LOCAL,
                    'label' => 'In Tanzania',
                    'count' => (int) ($byAvailability[Sourcing::LOCAL] ?? 0),
                ],
                [
                    'value' => Sourcing::IMPORT,
                    'label' => 'Order from abroad',
                    'count' => (int) ($byAvailability[Sourcing::IMPORT] ?? 0),
                ],
            ],
            'origins' => (clone $availabilityScope)
                ->select('source_country', DB::raw('COUNT(*) AS total'))
                ->whereNotNull('source_country')
                ->groupBy('source_country')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($row) => Sourcing::country($row->source_country)
                    ? Sourcing::country($row->source_country) + ['count' => (int) $row->total]
                    : null)
                ->filter()
                ->values(),
            'subcategories' => $this->subcategoryFacet($scope),
        ];
    }

    /**
     * The subcategory facet, resolved in one lookup rather than one per row.
     *
     * This used to call `Subcategory::find()` inside the map, so a listing
     * page issued up to thirty extra queries just to put names on the filter
     * chips — two thirds of every catalogue request. The counts still come
     * from the same grouped query; only the name lookup changed.
     */
    private function subcategoryFacet(Builder $scope): \Illuminate\Support\Collection
    {
        $rows = (clone $scope)
            ->select('subcategory_id', DB::raw('COUNT(*) AS total'))
            ->whereNotNull('subcategory_id')
            ->groupBy('subcategory_id')
            ->orderByDesc('total')
            ->limit(30)
            ->get();

        if ($rows->isEmpty()) {
            return collect();
        }

        $names = Subcategory::query()
            ->whereIn('id', $rows->pluck('subcategory_id'))
            ->pluck('name', 'id');

        return $rows
            ->map(fn ($row) => isset($names[$row->subcategory_id]) ? [
                'id'    => (int) $row->subcategory_id,
                'name'  => $names[$row->subcategory_id],
                'count' => (int) $row->total,
            ] : null)
            ->filter()
            ->values();
    }

    /**
     * Public seller directory.
     *
     * Only approved sellers with something in stock appear — the page exists
     * to help a shopper find a shop, so listing an empty or unapproved store
     * would waste the click.
     */
    public function vendors()
    {
        $vendors = \App\Models\Vendor::query()
            ->where('is_approved', true)
            ->withCount(['products' => fn ($q) => $q->where('stock', '>', 0)])
            // `whereHas` rather than `having` on the aggregate alias, for the
            // same reason `homeShelves()` avoids it: SQLite rejects a HAVING
            // clause on a non-aggregate query, so this endpoint returned a 500
            // on the test database while working on the production MySQL. Same
            // result on both, and no test could reach it before.
            ->whereHas('products', fn ($q) => $q->where('stock', '>', 0))
            ->orderByDesc('products_count')
            ->get()
            ->map(fn ($vendor) => [
                'id'            => $vendor->id,
                'name'          => $vendor->business_name,
                'logo'          => Media::url($vendor->logo),
                'product_count' => $vendor->products_count,
                'is_verified'   => (bool) $vendor->is_verified,
                'member_since'  => $vendor->created_at?->format('Y'),
            ])
            ->values()
            ->all();

        return response()->json(['vendors' => $vendors]);
    }

    /**
     * Homepage banners, grouped by where they belong.
     *
     * Placement lives in the database rather than in the page, so an
     * administrator can move a campaign from the carousel to a mid-page strip
     * without a deploy.
     */
    /**
     * Source countries that actually have stock behind them, commonest first.
     */
    private function originFacet(): array
    {
        return Product::query()
            ->withOnly([])
            ->select('source_country', DB::raw('COUNT(*) AS total'))
            ->whereNotNull('source_country')
            ->groupBy('source_country')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => Sourcing::country($row->source_country)
                ? Sourcing::country($row->source_country) + ['count' => (int) $row->total]
                : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * How many products can be promised within each of the storefront's four
     * delivery windows.
     *
     * The same `max_days` comparison the listing filter makes, answered for
     * every window in one grouped pass instead of one request per window.
     */
    private function deliveryWindows(): array
    {
        $windows = [3, 10, 14, 45];

        // Grouped on the same COALESCE the `max_days` listing filter uses, so
        // a tile's count and the page it opens can never disagree — including
        // for a listing whose seller never set a lead time.
        $promised = DB::raw(
            'COALESCE(lead_time_max_days, CASE WHEN availability = \'' . Sourcing::IMPORT . '\' THEN '
            . Sourcing::DEFAULT_LEAD_TIME[Sourcing::IMPORT]['max'] . ' ELSE '
            . Sourcing::DEFAULT_LEAD_TIME[Sourcing::LOCAL]['max'] . ' END)'
        );

        $rows = Product::query()
            ->withOnly([])
            ->select([DB::raw($promised->getValue(DB::connection()->getQueryGrammar()) . ' AS promised'), DB::raw('COUNT(*) AS total')])
            ->groupBy('promised')
            ->get();

        $counts = [];
        foreach ($windows as $days) {
            $counts[$days] = (int) $rows
                ->filter(fn ($row) => (int) $row->promised <= $days)
                ->sum('total');
        }

        return $counts;
    }

    private function bannerGroups(): array
    {
        $groups = Banner::query()
            ->live()
            ->whereIn('placement', ['hero', 'hero_side', 'promo'])
            ->get()
            ->groupBy('placement');

        $shape = fn (Banner $banner) => [
            'id'           => $banner->id,
            'title'        => $banner->title,
            'subtitle'     => $banner->subtitle,
            'alt'          => $banner->alt ?: $banner->title,
            'link'         => $banner->link,
            'cta_label'    => $banner->cta_label,
            'theme'        => $banner->theme,
            'image'        => Media::url($banner->image),
            // Falls back to the wide artwork so a banner without a dedicated
            // phone crop still renders rather than leaving a hole.
            'mobile_image' => Media::url($banner->mobile_image) ?? Media::url($banner->image),
        ];

        return [
            'hero'      => ($groups['hero'] ?? collect())->map($shape)->values()->all(),
            'hero_side' => ($groups['hero_side'] ?? collect())->map($shape)->first(),
            'promos'    => ($groups['promo'] ?? collect())->map($shape)->values()->all(),
        ];
    }

    /**
     * Visual "shop the category" strips: a category and the subcategories
     * beneath it, each with a representative photo taken from a real product
     * in that subcategory.
     *
     * Built from the live catalogue, so a subcategory that has been emptied
     * simply stops appearing instead of leading to a dead grid.
     */
    private function categoryCollections(int $limit = 4): array
    {
        $categories = Category::query()
            ->with(['subcategories' => fn ($q) => $q->withCount('products')])
            ->withCount('products')
            ->has('products')
            ->orderByDesc('products_count')
            ->limit($limit)
            ->get();

        // Every tile on the page needs one representative photo. Resolved for
        // all of them together below, because doing it inside the map issued a
        // product query *and* an images query per tile — the single largest
        // contributor to the home feed's cold rebuild.
        $tileSubcategoryIds = $categories
            ->flatMap(fn (Category $category) => $category->subcategories
                ->filter(fn ($sub) => $sub->products_count > 0)
                ->sortByDesc('products_count')
                ->take(7)
                ->pluck('id'))
            ->unique()
            ->values();

        $tileImages = $this->representativeImages($tileSubcategoryIds->all());

        return $categories
            ->map(function (Category $category) use ($tileImages) {
                $tiles = $category->subcategories
                    ->filter(fn ($sub) => $sub->products_count > 0)
                    ->sortByDesc('products_count')
                    ->take(7)
                    ->map(fn ($sub) => [
                        'id'            => $sub->id,
                        'category_id'   => $category->id,
                        'name'          => trim($sub->name),
                        'product_count' => $sub->products_count,
                        'image'         => Media::url($tileImages[$sub->id] ?? null),
                    ])
                    ->values()
                    ->all();

                return [
                    'id'     => $category->id,
                    'title'  => trim($category->name),
                    'tiles'  => $tiles,
                ];
            })
            // A strip of one tile is not a collection; it just looks broken.
            ->filter(fn ($collection) => count($collection['tiles']) >= 3)
            ->values()
            ->all();
    }

    /**
     * One photo per subcategory, for every subcategory at once.
     *
     * Takes the newest product in each that actually has an image. Two queries
     * regardless of how many subcategories are asked for, in place of two per
     * subcategory.
     *
     * @param  list<int>  $subcategoryIds
     * @return array<int, string>  subcategory id => image path
     */
    private function representativeImages(array $subcategoryIds): array
    {
        if (empty($subcategoryIds)) {
            return [];
        }

        // The newest image-bearing product in each subcategory. Grouping in
        // PHP rather than SQL keeps this working identically on MySQL and on
        // the SQLite the test suite runs against.
        $products = Product::query()
            ->withOnly([])
            ->select('id', 'subcategory_id')
            ->whereIn('subcategory_id', $subcategoryIds)
            ->whereHas('images')
            ->orderByDesc('id')
            ->get();

        $chosen = [];
        foreach ($products as $product) {
            $chosen[$product->subcategory_id] ??= $product->id;
        }

        if (empty($chosen)) {
            return [];
        }

        $images = \App\Models\ProductImage::query()
            ->select('product_id', 'image')
            ->whereIn('product_id', array_values($chosen))
            ->get()
            ->groupBy('product_id');

        $out = [];
        foreach ($chosen as $subcategoryId => $productId) {
            $image = $images[$productId][0]->image ?? null;
            if ($image !== null) {
                $out[$subcategoryId] = $image;
            }
        }

        return $out;
    }

    private function categoryRail(): array
    {
        return Category::query()
            ->withCount('products')
            ->orderByDesc('products_count')
            ->get()
            ->map(fn ($category) => [
                'id'            => $category->id,
                'name'          => $category->name,
                'icon'          => $category->icon,
                'image'         => Media::url($category->icon_image),
                'product_count' => $category->products_count,
            ])
            ->values()
            ->all();
    }

    /**
     * One shelf per category that actually has stock, mirroring the reference
     * homepage's stack of horizontally scrolling product rails.
     */
    private function homeShelves(int $size): array
    {
        return Category::query()
            ->withCount('products')
            // `has()` rather than `having()` on the aggregate alias: the latter
            // is not valid against a subquery count on SQLite.
            ->has('products')
            ->orderByDesc('products_count')
            ->limit(8)
            ->get()
            ->map(fn ($category) => [
                'id'       => $category->id,
                'title'    => $category->name,
                'products' => ProductCardResource::collection(
                    $this->baseListing()->where('category_id', $category->id)->limit($size)->get()
                )->resolve(),
            ])
            ->filter(fn ($shelf) => count($shelf['products']) > 0)
            ->values()
            ->all();
    }
}
