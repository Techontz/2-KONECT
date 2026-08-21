<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Category;
use App\Models\ProductReview;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class ProductController extends Controller
{
    /* -------------------------------------------------------------------------- */
    /* 🟢 CREATE PRODUCT */
    /* -------------------------------------------------------------------------- */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user->vendor) {
            return response()->json(['message' => 'Only vendors can add products.'], 403);
        }

        // Approval is enforced here, not only by hiding the button: a seller
        // whose application is still pending must not be able to put stock in
        // front of shoppers by calling the endpoint directly.
        if (!$user->vendor->canPublish()) {
            return response()->json([
                'message' => 'Your seller account is awaiting approval.',
                'seller_status' => $user->vendor->seller_status,
            ], 403);
        }

        $rules = [
            'name'           => 'required|string|max:100',
            'category_id'    => 'required|exists:categories,id',
            'subcategory_id' => 'nullable|exists:subcategories,id',
            'description'       => 'nullable|string',
            'short_description' => 'nullable|string|max:300',
            // Structured properties, keyed by attribute id. Kept out of the
            // description so the catalogue can be filtered on them.
            'attributes'        => 'nullable|array',
            'attributes.*'      => 'nullable|string|max:255',
            'old_price'      => 'nullable|numeric',
            'new_price'      => 'required|numeric',
            'stock'          => 'required|integer|min:0',
            // Where the item actually is. Optional, so the Flutter app and any
            // older client keep posting exactly what they always did and get
            // the local default.
            'availability'       => 'nullable|string|in:local,import',
            'source_country'     => 'nullable|string|size:2',
            'shipping_method'    => 'nullable|string|in:air,sea,road',
            'lead_time_min_days' => 'nullable|integer|min:1|max:180',
            'lead_time_max_days' => 'nullable|integer|min:1|max:180|gte:lead_time_min_days',
            'fulfilment_location' => 'nullable|string|max:255',
        ];

        if ($request->hasFile('images')) {
            $files = $request->file('images');
            if (!is_array($files)) $files = [$files];
            foreach ($files as $idx => $file) {
                $rules["images.$idx"] = 'image|max:4096';
            }
        } else {
            return response()->json([
                'message' => 'Invalid product data.',
                'errors'  => ['images' => ['At least one product image is required.']]
            ], 422);
        }

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Invalid product data.',
                'errors'  => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $product = Product::create([
                'vendor_id'      => $user->vendor->id,
                'category_id'    => $request->input('category_id'),
                'subcategory_id' => $request->input('subcategory_id'),
                'name'              => $request->input('name'),
                'short_description' => $request->input('short_description'),
                'description'       => $request->input('description'),
                'old_price'      => $request->input('old_price'),
                'new_price'      => $request->input('new_price'),
                'stock'          => $request->input('stock', 0),
            ] + $this->sourcingAttributes($request));

            foreach ($request->file('images') as $file) {
                if ($file->isValid()) {
                    $path = $file->store('products', 'public');
                    $product->images()->create(['image' => $path]);
                }
            }

            if ($request->has('attributes')) {
                foreach ($request->input('attributes') as $attrId => $value) {
                    if ($value !== null && $value !== '') {
                        $product->attributeValues()->create([
                            'attribute_id' => $attrId,
                            'value'        => $value,
                        ]);
                    }
                }
            }

            DB::commit();

            $product = Product::with(['images', 'attributeValues.attribute', 'subcategory', 'category'])
                ->find($product->id);

            return response()->json([
                'message' => 'Product created successfully.',
                'product' => $product,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Product create error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Failed to create product.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sourcing columns, taken from the request only when they were sent.
     *
     * An omitted field must not blank an existing value on update, and a
     * client that has never heard of sourcing must keep working — so this
     * returns only the keys actually present.
     */
    private function sourcingAttributes(Request $request): array
    {
        $fields = [
            'availability', 'source_country', 'shipping_method',
            'lead_time_min_days', 'lead_time_max_days', 'fulfilment_location',
        ];

        $attributes = [];

        foreach ($fields as $field) {
            if (! $request->has($field)) {
                continue;
            }

            $value = $request->input($field);
            $attributes[$field] = $value === '' ? null : $value;
        }

        if (isset($attributes['source_country']) && $attributes['source_country'] !== null) {
            $attributes['source_country'] = strtoupper($attributes['source_country']);
        }

        // A local listing has no international route; clearing it here stops a
        // product that used to be imported from keeping a stale sea freight
        // estimate after the seller moves the stock into the country.
        if (($attributes['availability'] ?? null) === \App\Support\Sourcing::LOCAL) {
            $attributes['shipping_method'] = null;
        }

        return $attributes;
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 FETCH ALL VENDOR PRODUCTS (NO LIMIT) */
    /* -------------------------------------------------------------------------- */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->vendor) {
            return response()->json(['message' => 'Only vendors can view products.'], 403);
        }

        $cacheKey = 'vendor_products_' . $user->vendor->id;

        $products = \Cache::remember($cacheKey, 60, function () use ($user) {
            return Product::where('vendor_id', $user->vendor->id)
                ->with(['images', 'attributeValues.attribute', 'subcategory', 'category', 'reviews'])
                ->latest()
                ->get();
        });

        $formatted = $products->map(function ($p) {
            return [
                'id'             => $p->id,
                'name'           => $p->name,
                'description'    => $p->description,
                'old_price'      => $p->old_price,
                'new_price'      => $p->new_price,
                'stock'          => $p->stock,
                'images' => $p->images->map(function ($img) {
                        $image = $img->image;

                        return [
                            'image' => filter_var($image, FILTER_VALIDATE_URL)
                                ? $image
                                : asset('storage/' . ltrim($image, '/')),
                        ];
                    }),
                'average_rating' => round($p->reviews->avg('rating'), 1) ?? 0.0,
                'review_count'   => $p->reviews->count(),
                'subcategory'    => $p->subcategory ? [
                    'id' => $p->subcategory->id,
                    'name' => $p->subcategory->name
                ] : null,
                'category' => $p->category ? [
                    'id' => $p->category->id,
                    'name' => $p->category->name
                ] : null,
            ];
        });

        return response()->json(['products' => $formatted]);
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 UPDATE PRODUCT */
    /* -------------------------------------------------------------------------- */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        // Without this a customer account reaches `$user->vendor->id` on null
        // and the request dies with a 500 instead of a clean 403.
        if (! $user->vendor) {
            return response()->json(['message' => 'Only vendors can edit products.'], 403);
        }

        $product = Product::where('id', $id)->where('vendor_id', $user->vendor->id)->first();
        if (!$product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $rules = [
            'name'           => 'sometimes|required|string|max:100',
            'category_id'    => 'sometimes|required|exists:categories,id',
            'subcategory_id' => 'nullable|exists:subcategories,id',
            'description'    => 'nullable|string',
            'old_price'      => 'nullable|numeric',
            'new_price'      => 'sometimes|required|numeric',
            'stock'          => 'sometimes|required|integer|min:0',
            'short_description' => 'nullable|string|max:300',
            'availability'       => 'nullable|string|in:local,import',
            'source_country'     => 'nullable|string|size:2',
            'shipping_method'    => 'nullable|string|in:air,sea,road',
            'lead_time_min_days' => 'nullable|integer|min:1|max:180',
            'lead_time_max_days' => 'nullable|integer|min:1|max:180|gte:lead_time_min_days',
            'fulfilment_location' => 'nullable|string|max:255',
        ];

        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $idx => $file) {
                $rules["images.$idx"] = 'image|max:4096';
            }
        }

        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Invalid product data.',
                'errors'  => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $product->update($request->only([
                'name', 'category_id', 'subcategory_id', 'description',
                'short_description', 'old_price', 'new_price', 'stock',
            ]) + $this->sourcingAttributes($request));

            // Existing photos are production data and are only removed when the
            // seller explicitly asks. Previously *any* upload wiped the whole
            // gallery first, so adding a second angle destroyed the first.
            if ($request->input('remove_images') == 'true') {
                $product->images()->delete();
            }

            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $file) {
                    if ($file->isValid()) {
                        $path = $file->store('products', 'public');
                        $product->images()->create(['image' => $path]);
                    }
                }
            }

            // Individual images can be dropped by id, which is how the vendor
            // UI removes one photo without touching the rest.
            if ($request->filled('remove_image_ids')) {
                $ids = (array) $request->input('remove_image_ids');
                $product->images()->whereIn('id', $ids)->delete();
            }

            $product->attributeValues()->delete();
            if ($request->has('attributes')) {
                foreach ($request->input('attributes') as $attrId => $value) {
                    if ($value !== null && $value !== '') {
                        $product->attributeValues()->create([
                            'attribute_id' => $attrId,
                            'value'        => $value,
                        ]);
                    }
                }
            }

            DB::commit();

            $product = Product::with(['images', 'attributeValues.attribute', 'subcategory', 'category'])->find($product->id);

            return response()->json([
                'message' => 'Product updated successfully.',
                'product' => $product,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update product.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 DELETE PRODUCT */
    /* -------------------------------------------------------------------------- */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (! $user->vendor) {
            return response()->json(['message' => 'Only vendors can delete products.'], 403);
        }

        $product = Product::where('id', $id)->where('vendor_id', $user->vendor->id)->first();
        if (!$product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        DB::beginTransaction();
        try {
            $product->images()->delete();
            $product->delete();
            DB::commit();
            return response()->json(['message' => 'Product deleted.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to delete product.', 'error' => $e->getMessage()], 500);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 CATEGORY & SUBCATEGORY PRODUCTS */
    /* -------------------------------------------------------------------------- */
    public function productsByCategory($categoryId)
    {
        $category = Category::with([
            'subcategories.products.images',
            'subcategories.products.attributeValues.attribute',
            'subcategories.products.reviews'
        ])->findOrFail($categoryId);

        $result = [
            'category' => [
                'id'   => $category->id,
                'name' => $category->name,
            ],
            'subcategories' => [],
        ];

        foreach ($category->subcategories as $sub) {
            $products = $sub->products->sortByDesc('id')->take(10);
            $result['subcategories'][] = [
                'id'          => $sub->id,
                'name'        => $sub->name,
                'icon'        => $sub->icon,
                'icon_image'  => $sub->icon_image_url,
                'products'    => $products->map(function ($p) {
                    return [
                        'id'             => $p->id,
                        'name'           => $p->name,
                        'description'    => $p->description,
                        'old_price'      => $p->old_price,
                        'new_price'      => $p->new_price,
                        'stock'          => $p->stock,
                        'images'         => $p->images->map(fn($img) => asset('storage/' . $img->image)),
                        'average_rating' => round($p->reviews->avg('rating'), 1) ?? 0.0,
                        'review_count'   => $p->reviews->count(),
                        'attribute_values' => $p->attributeValues->map(function ($av) {
                            return [
                                'id'        => $av->id,
                                'value'     => $av->value,
                                'attribute' => [
                                    'id'   => $av->attribute->id,
                                    'name' => $av->attribute->name,
                                ],
                            ];
                        })->values(),
                    ];
                })->values(),
            ];
        }

        return response()->json($result);
    }

    public function productsBySubcategory($subcategoryId)
    {
        $subcategory = \App\Models\Subcategory::with([
            'products.images',
            'products.attributeValues.attribute',
            'products.reviews'
        ])->findOrFail($subcategoryId);

        $products = $subcategory->products->sortByDesc('id')->map(function ($p) {
            return [
                'id'             => $p->id,
                'name'           => $p->name,
                'description'    => $p->description,
                'old_price'      => $p->old_price,
                'new_price'      => $p->new_price,
                'stock'          => $p->stock,
                'images'         => $p->images->map(fn($img) => asset('storage/' . $img->image)),
                'average_rating' => round($p->reviews->avg('rating'), 1) ?? 0.0,
                'review_count'   => $p->reviews->count(),
                'attribute_values' => $p->attributeValues->map(function ($av) {
                    return [
                        'id'        => $av->id,
                        'value'     => $av->value,
                        'attribute' => [
                            'id'   => $av->attribute->id,
                            'name' => $av->attribute->name,
                        ],
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'subcategory' => [
                'id'   => $subcategory->id,
                'name' => $subcategory->name,
            ],
            'products' => $products,
        ]);
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 PUBLIC PRODUCT DETAILS */
    /* -------------------------------------------------------------------------- */
    public function showPublic($id)
    {
        $product = Product::with([
            'images',
            'attributeValues.attribute',
            'subcategory',
            'category',
            'vendor.user',
            'reviews' => fn($q) => $q->with('user')
        ])->find($id);

        if (!$product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        return response()->json([
            'product' => [
                'id'             => $product->id,
                'name'           => $product->name,
                'description'    => $product->description,
                'old_price'      => $product->old_price,
                'new_price'      => $product->new_price,
                'stock'          => $product->stock,
                'images'         => $product->images->map(fn($img) => asset('storage/' . $img->image)),
                'category'       => $product->category ? [
                    'id'   => $product->category->id,
                    'name' => $product->category->name,
                ] : null,
                'subcategory'    => $product->subcategory ? [
                    'id'   => $product->subcategory->id,
                    'name' => $product->subcategory->name,
                ] : null,
                'vendor'         => $product->vendor ? [
                    'id'            => $product->vendor->id,
                    'user_id'       => $product->vendor->user_id,
                    'business_name' => $product->vendor->business_name,
                    'phone'         => $product->vendor->phone,
                    'logo'          => $product->vendor->logo ? asset('storage/' . $product->vendor->logo) : null,
                    'email'         => $product->vendor->email,
                ] : null,
            ],
            'average_rating' => round($product->reviews->avg('rating'), 1) ?? 0.0,
            'review_count'   => $product->reviews->count(),
            'reviews'        => $product->reviews->map(function ($review) {
                return [
                    'user'    => $review->user ? $review->user->name : 'User',
                    'rating'  => $review->rating,
                    'comment' => $review->comment,
                    'date'    => $review->created_at->format('Y-m-d'),
                ];
            }),
        ]);
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 SEARCH PRODUCTS */
    /* -------------------------------------------------------------------------- */
    public function search(Request $request)
    {
        $query = $request->query('q', '');

        if (!$query) {
            return response()->json(['products' => []]);
        }

        try {
            $products = Product::with(['images', 'attributeValues.attribute'])
                ->where('name', 'like', "%{$query}%")
                ->orWhere('description', 'like', "%{$query}%")
                ->take(20)
                ->get();

            $results = $products->map(function ($p) {
                return [
                    'id'    => $p->id,
                    'name'  => $p->name,
                    'new_price' => $p->new_price,
                    'old_price' => $p->old_price,
                    'images' => $p->images->map(fn($img) => asset('storage/' . $img->image)),
                    'stock' => $p->stock,
                ];
            });

            return response()->json(['products' => $results]);
        } catch (\Exception $e) {
            Log::error('Search failed: ' . $e->getMessage());
            return response()->json(['message' => 'Server error', 'error' => $e->getMessage()], 500);
        }
    }

    /* -------------------------------------------------------------------------- */
    /* 🟢 SUBMIT REVIEW */
    /* -------------------------------------------------------------------------- */
    public function submitReview(Request $request, $id)
    {
        $user = $request->user();

        $request->validate([
            'rating'  => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $product = Product::findOrFail($id);

        $existing = ProductReview::where('user_id', $user->id)
            ->where('product_id', $id)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You already reviewed this product.'], 409);
        }

        $review = ProductReview::create([
            'product_id' => $id,
            'user_id'    => $user->id,
            'rating'     => $request->rating,
            'comment'    => $request->comment,
        ]);

        return response()->json([
            'message' => 'Review submitted.',
            'review'  => $review,
        ], 201);
    }
}
