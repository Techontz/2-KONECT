<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\CartItem;
use App\Models\Product;

class CartController extends Controller
{
    /**
     * 🛒 Get all cart items for the authenticated user
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $items = CartItem::with('product')
            ->where('user_id', $user->id)
            ->get();

        return response()->json(['items' => $items]);
    }

    /**
     * ➕ Add to cart (or increment quantity)
     */
    public function add(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity'   => 'sometimes|integer|min:1',
        ]);

        $productId = $request->input('product_id');
        $qty = $request->input('quantity', 1);

        $cartItem = CartItem::firstOrNew([
            'user_id'    => $user->id,
            'product_id' => $productId,
        ]);

        $cartItem->quantity = ($cartItem->exists ? $cartItem->quantity : 0) + $qty;
        $cartItem->save();

        return response()->json([
            'message' => 'Added to cart successfully.',
            'item'    => $cartItem->load('product'),
        ]);
    }

    /**
     * ➖ Update quantity (increment/decrement)
     */
    public function update(Request $request)
    {
        $request->validate([
            'product_id' => 'required|integer|exists:products,id',
            'quantity'   => 'required|integer|min:0',
        ]);

        $user = $request->user();

        $cartItem = CartItem::where('user_id', $user->id)
            ->where('product_id', $request->product_id)
            ->first();

        if (!$cartItem) {
            return response()->json(['message' => 'Item not found in cart'], 404);
        }

        // ✅ If quantity is 0 → remove item
        if ($request->quantity == 0) {
            $cartItem->delete();

            return response()->json([
                'message' => 'Item removed from cart',
                'cart'    => CartItem::where('user_id', $user->id)
                    ->with('product')
                    ->get(),
            ]);
        }

        // ✅ Otherwise update the quantity
        $cartItem->update(['quantity' => $request->quantity]);

        return response()->json([
            'message' => 'Cart updated successfully',
            'cart'    => CartItem::where('user_id', $user->id)
                ->with('product')
                ->get(),
        ]);
    }

    /**
     * 🗑️ Remove item completely
     */
    public function remove(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'product_id' => 'required|exists:products,id',
        ]);

        $deleted = CartItem::where('user_id', $user->id)
            ->where('product_id', $request->product_id)
            ->delete();

        return response()->json([
            'message' => $deleted ? 'Removed from cart.' : 'Item not found.',
        ]);
    }

    /**
     * 🧹 Clear the entire cart
     */
    public function clear(Request $request)
    {
        $user = $request->user();

        CartItem::where('user_id', $user->id)->delete();

        return response()->json([
            'message' => 'Cart cleared successfully.',
        ]);
    }
}
