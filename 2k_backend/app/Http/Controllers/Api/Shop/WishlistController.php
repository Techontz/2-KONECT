<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductCardResource;
use App\Models\Product;
use App\Models\Wishlist;
use Illuminate\Http\Request;

/**
 * Server-side wishlist for signed-in shoppers.
 *
 * Guests keep a wishlist in browser storage; `sync` folds that local list into
 * the account on login so nothing a visitor saved before registering is lost.
 */
class WishlistController extends Controller
{
    public function index(Request $request)
    {
        $productIds = Wishlist::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->pluck('product_id');

        $products = Product::query()
            ->whereIn('id', $productIds)
            ->with(['images', 'category', 'subcategory', 'vendor'])
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->get()
            // Preserve "most recently saved first" rather than id order.
            ->sortBy(fn ($p) => $productIds->search($p->id))
            ->values();

        return response()->json([
            'products' => ProductCardResource::collection($products)->resolve(),
            'ids'      => $productIds->values(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate(['product_id' => 'required|integer|exists:products,id']);

        Wishlist::firstOrCreate([
            'user_id'    => $request->user()->id,
            'product_id' => $request->integer('product_id'),
        ]);

        return response()->json(['message' => 'Saved to wishlist.'], 201);
    }

    public function destroy(Request $request, int $productId)
    {
        Wishlist::where('user_id', $request->user()->id)
            ->where('product_id', $productId)
            ->delete();

        return response()->json(['message' => 'Removed from wishlist.']);
    }

    /**
     * Merge a guest's locally-stored wishlist into their account.
     *
     * Additive by design: items already saved server-side survive, so signing
     * in on a second device never wipes the first device's list.
     */
    public function sync(Request $request)
    {
        $request->validate([
            'product_ids'   => 'required|array|max:200',
            'product_ids.*' => 'integer|exists:products,id',
        ]);

        $userId = $request->user()->id;

        foreach ($request->input('product_ids') as $productId) {
            Wishlist::firstOrCreate(['user_id' => $userId, 'product_id' => $productId]);
        }

        return $this->index($request);
    }
}
