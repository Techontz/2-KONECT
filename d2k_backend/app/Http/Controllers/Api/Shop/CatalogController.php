<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductCardResource;
use App\Http\Resources\ProductDetailResource;
use App\Models\Banner;
use App\Models\Category;
use App\Models\Product;
use App\Models\Subcategory;
use App\Support\Media;
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

        $payload = Cache::remember('shop.home.v2', 300, function () use ($shelfSize) {
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
        $categories = Cache::remember('shop.categories.v1', 600, function () {
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
        $category = Category::with('subcategories')->find($id);

        if (! $category) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        return response()->json([
            'category' => [
                'id'    => $category->id,
                'name'  => $category->name,
                'image' => Media::url($category->icon_image),
            ],
            'subcategories' => $category->subcategories->map(fn ($sub) => [
                'id'    => $sub->id,
                'name'  => $sub->name,
                'image' => Media::url($sub->icon_image),
                'product_count' => Product::where('subcategory_id', $sub->id)->count(),
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
                ->values(),
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
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->latest('id');
    }

    private function applyFilters(Builder $query, array $f): void
    {
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
            ->when($f['rating'] ?? null, fn ($q, $v) => $q->having('reviews_avg_rating', '>=', $v));

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
        $scope = Product::query();
        $this->applyFilters($scope, array_diff_key($f, ['min_price' => 1, 'max_price' => 1]));

        $range = (clone $scope)
            ->selectRaw('MIN(new_price) AS min_price, MAX(new_price) AS max_price')
            ->first();

        return [
            'price' => [
                'min' => (float) ($range->min_price ?? 0),
                'max' => (float) ($range->max_price ?? 0),
            ],
            'subcategories' => (clone $scope)
                ->select('subcategory_id', DB::raw('COUNT(*) AS total'))
                ->whereNotNull('subcategory_id')
                ->groupBy('subcategory_id')
                ->orderByDesc('total')
                ->limit(30)
                ->get()
                ->map(function ($row) {
                    $sub = Subcategory::find($row->subcategory_id);

                    return $sub ? [
                        'id' => $sub->id, 'name' => $sub->name, 'count' => (int) $row->total,
                    ] : null;
                })
                ->filter()
                ->values(),
        ];
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
            ->having('products_count', '>', 0)
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

        return $categories
            ->map(function (Category $category) {
                $tiles = $category->subcategories
                    ->filter(fn ($sub) => $sub->products_count > 0)
                    ->sortByDesc('products_count')
                    ->take(7)
                    ->map(function ($sub) use ($category) {
                        // One extra query per tile, but only for the handful of
                        // tiles actually rendered, and the whole payload is
                        // cached for five minutes.
                        $image = Product::query()
                            ->where('subcategory_id', $sub->id)
                            ->whereHas('images')
                            ->with('images')
                            ->latest('id')
                            ->first()?->images->first()?->image;

                        return [
                            'id'            => $sub->id,
                            'category_id'   => $category->id,
                            'name'          => trim($sub->name),
                            'product_count' => $sub->products_count,
                            'image'         => Media::url($image),
                        ];
                    })
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
