<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Storefront checkout and order history.
 *
 * The `orders` table stores one row per product line. A single checkout is
 * tied together by a shared `reference`, which is what the shopper sees and
 * quotes to support. This controller reads and writes that grouping.
 */
class OrderController extends Controller
{
    /** Flat delivery fee in TZS. */
    private const DELIVERY_FEE = 3000;

    /**
     * Place an order.
     *
     * Runs in a transaction with the product rows locked, so two shoppers
     * racing for the last unit cannot both succeed. Stock is decremented here
     * — the previous implementation checked availability but never reduced it,
     * so the catalogue never sold out.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'items'                => 'required|array|min:1|max:50',
            'items.*.product_id'   => 'required|integer|exists:products,id',
            'items.*.quantity'     => 'required|integer|min:1|max:99',
            'delivery_address'     => 'required|string|max:500',
            'customer_phone'       => 'required|string|max:40',
            'payment_method'       => 'required|string|in:cash_on_delivery,mobile_money',
            'payment_provider'     => 'nullable|string|max:40',
        ]);

        $user      = $request->user();
        $reference = $this->newReference();

        try {
            $result = DB::transaction(function () use ($data, $user, $reference) {
                $subtotal = 0;
                $lines    = [];

                foreach ($data['items'] as $item) {
                    /** @var Product $product */
                    $product = Product::lockForUpdate()->find($item['product_id']);

                    if (! $product) {
                        abort(422, 'A product in your cart is no longer available.');
                    }

                    if ($product->stock < $item['quantity']) {
                        abort(422, sprintf(
                            'Only %d left of "%s".',
                            $product->stock,
                            $product->name
                        ));
                    }

                    $lineTotal = (float) $product->new_price * $item['quantity'];
                    $subtotal += $lineTotal;

                    $lines[] = Order::create([
                        'reference'        => $reference,
                        'user_id'          => $user->id,
                        'vendor_id'        => $product->vendor_id,
                        'product_id'       => $product->id,
                        'quantity'         => $item['quantity'],
                        'price'            => $product->new_price,
                        'total'            => $lineTotal,
                        'status'           => 'pending',
                        'payment_method'   => $data['payment_method'],
                        'payment_provider' => $data['payment_provider'] ?? null,
                        'delivery_address' => $data['delivery_address'],
                        'customer_phone'   => $data['customer_phone'],
                        'external_id'      => (string) Str::uuid(),
                    ]);

                    // Reserve the stock that was just sold.
                    $product->decrement('stock', $item['quantity']);
                }

                // The order is placed, so the cart that produced it is spent.
                CartItem::where('user_id', $user->id)->delete();

                return ['lines' => $lines, 'subtotal' => $subtotal];
            });
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            throw $e;
        }

        // The delivery fee is charged once per order, not per line, so it is
        // recorded against the first line only.
        $first = $result['lines'][0];
        $first->update(['delivery_fee' => self::DELIVERY_FEE]);

        return response()->json([
            'message'   => 'Order placed successfully.',
            'reference' => $reference,
            'order'     => $this->groupToPayload($reference, collect($result['lines'])->pluck('id')->all()),
        ], 201);
    }

    /** The signed-in shopper's order history, one entry per checkout. */
    public function index(Request $request)
    {
        $orders = Order::query()
            ->with(['product.images', 'vendor'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->groupBy('reference')
            ->map(fn ($lines) => $this->presentGroup($lines))
            ->values();

        return response()->json(['orders' => $orders]);
    }

    /** A single order, addressed by its reference. */
    public function show(Request $request, string $reference)
    {
        $lines = Order::query()
            ->with(['product.images', 'vendor'])
            ->where('user_id', $request->user()->id)
            ->where('reference', $reference)
            ->get();

        if ($lines->isEmpty()) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        return response()->json(['order' => $this->presentGroup($lines)]);
    }

    /**
     * Cancel an order the shopper placed, returning the reserved stock.
     * Only orders that have not yet been dispatched can be withdrawn.
     */
    public function cancel(Request $request, string $reference)
    {
        $lines = Order::where('user_id', $request->user()->id)
            ->where('reference', $reference)
            ->get();

        if ($lines->isEmpty()) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $cancellable = ['pending', 'processing'];

        if (! $lines->every(fn ($line) => in_array($line->status, $cancellable, true))) {
            return response()->json([
                'message' => 'This order can no longer be cancelled.',
            ], 422);
        }

        DB::transaction(function () use ($lines) {
            foreach ($lines as $line) {
                // Put the reserved units back on sale.
                Product::where('id', $line->product_id)->increment('stock', $line->quantity);
                $line->update(['status' => 'cancelled']);
            }
        });

        return response()->json(['message' => 'Order cancelled.']);
    }

    /* ---------------------------------------------------------------- */

    private function newReference(): string
    {
        // Short, unambiguous and safe to read aloud: no O/0 or I/1 confusion.
        do {
            $reference = 'D2K-' . strtoupper(Str::random(8));
        } while (Order::where('reference', $reference)->exists());

        return $reference;
    }

    private function groupToPayload(string $reference, array $ids): array
    {
        return $this->presentGroup(
            Order::with(['product.images', 'vendor'])->whereIn('id', $ids)->get()
        );
    }

    /** Turn a set of order lines sharing a reference into one order object. */
    private function presentGroup($lines): array
    {
        $first = $lines->first();

        $subtotal = (float) $lines->sum('total');
        $delivery = (float) $lines->sum('delivery_fee');

        return [
            'reference'        => $first->reference,
            'status'           => $this->rollUpStatus($lines),
            'placed_at'        => optional($first->created_at)->toIso8601String(),
            'item_count'       => (int) $lines->sum('quantity'),
            'subtotal'         => round($subtotal, 2),
            'delivery_fee'     => round($delivery, 2),
            'total'            => round($subtotal + $delivery, 2),
            'currency'         => 'TZS',
            'payment_method'   => $first->payment_method,
            'delivery_address' => $first->delivery_address,
            'customer_phone'   => $first->customer_phone,
            'items'            => $lines->map(fn ($line) => [
                'id'       => $line->id,
                'product'  => $line->product ? [
                    'id'    => $line->product->id,
                    'name'  => $line->product->name,
                    'image' => Media::url(optional($line->product->images->first())->image),
                ] : null,
                'vendor'   => $line->vendor?->business_name,
                'quantity' => (int) $line->quantity,
                'price'    => (float) $line->price,
                'total'    => (float) $line->total,
                'status'   => $line->status,
            ])->values(),
        ];
    }

    /**
     * An order spanning several vendors can have lines at different stages.
     * Show the least-advanced one, so an order is only "completed" when every
     * vendor has actually delivered.
     */
    private function rollUpStatus($lines): string
    {
        $rank = ['cancelled' => 0, 'pending' => 1, 'processing' => 2, 'shipped' => 3, 'completed' => 4];

        $statuses = $lines->pluck('status')->unique();

        if ($statuses->count() === 1) {
            return $statuses->first();
        }

        // Ignore cancelled lines when the rest of the order is still live.
        $live = $statuses->reject(fn ($s) => $s === 'cancelled');

        if ($live->isEmpty()) {
            return 'cancelled';
        }

        return $live->sortBy(fn ($s) => $rank[$s] ?? 99)->first();
    }
}
