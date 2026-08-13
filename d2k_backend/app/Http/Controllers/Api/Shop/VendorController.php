<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductCardResource;
use App\Models\Order;
use App\Models\Product;
use App\Models\Vendor;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Vendor portal API.
 *
 * Every query is scoped to the authenticated vendor's own id, so one seller
 * can never read or change another's products, orders or earnings. The
 * marketplace's existing approval rule (`vendors.is_approved`) is respected
 * rather than reinvented.
 */
class VendorController extends Controller
{
    /** Resolve the calling user's vendor, or fail closed. */
    private function vendor(Request $request): ?Vendor
    {
        return $request->user()?->vendor;
    }

    /** Headline numbers for the vendor dashboard. */
    public function dashboard(Request $request)
    {
        $vendor = $this->vendor($request);

        if (! $vendor) {
            return response()->json(['message' => 'This account is not a seller account.'], 403);
        }

        $orders = Order::where('vendor_id', $vendor->id);

        // Cancelled lines are excluded from earnings — a seller should never
        // see money they will not be paid.
        $earned = (clone $orders)->whereNotIn('status', ['cancelled'])->sum('total');
        $paidOut = (clone $orders)->where('status', 'completed')->sum('total');

        return response()->json([
            'vendor' => [
                'id'          => $vendor->id,
                'name'        => $vendor->business_name,
                'logo'        => Media::url($vendor->logo),
                'phone'       => $vendor->phone,
                'email'       => $vendor->email,
                'address'     => $vendor->business_address,
                'description' => $vendor->description,
                'is_approved' => (bool) $vendor->is_approved,
                'since'       => optional($vendor->created_at)->format('M Y'),
            ],
            'stats' => [
                'products'       => Product::where('vendor_id', $vendor->id)->count(),
                'in_stock'       => Product::where('vendor_id', $vendor->id)->where('stock', '>', 0)->count(),
                'out_of_stock'   => Product::where('vendor_id', $vendor->id)->where('stock', '<=', 0)->count(),
                'low_stock'      => Product::where('vendor_id', $vendor->id)->whereBetween('stock', [1, 5])->count(),
                'orders'         => (clone $orders)->count(),
                'orders_pending' => (clone $orders)->where('status', 'pending')->count(),
                'units_sold'     => (int) (clone $orders)->whereNotIn('status', ['cancelled'])->sum('quantity'),
                'earnings'       => round((float) $earned, 2),
                'paid_out'       => round((float) $paidOut, 2),
                'currency'       => 'TZS',
            ],
            'sales_trend' => $this->salesTrend($vendor->id),
            'top_products' => $this->topProducts($vendor->id),
            'low_stock_products' => ProductCardResource::collection(
                Product::where('vendor_id', $vendor->id)
                    ->where('stock', '<=', 5)
                    ->with(['images', 'category'])
                    ->orderBy('stock')
                    ->limit(10)
                    ->get()
            )->resolve(),
        ]);
    }

    /** The vendor's own catalogue, paginated and searchable. */
    public function products(Request $request)
    {
        $vendor = $this->vendor($request);

        if (! $vendor) {
            return response()->json(['message' => 'This account is not a seller account.'], 403);
        }

        $query = Product::query()
            ->where('vendor_id', $vendor->id)
            ->with(['images', 'category', 'subcategory'])
            ->withAvg('reviews', 'rating')
            ->withCount('reviews');

        if ($term = $request->query('q')) {
            $query->where('name', 'like', '%' . $term . '%');
        }

        if ($request->query('stock') === 'out') {
            $query->where('stock', '<=', 0);
        } elseif ($request->query('stock') === 'low') {
            $query->whereBetween('stock', [1, 5]);
        }

        $paginator = $query->latest('id')->paginate(min((int) $request->query('per_page', 24), 60));

        return response()->json([
            'products' => ProductCardResource::collection($paginator->items())->resolve(),
            'meta'     => [
                'total'        => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'has_more'     => $paginator->hasMorePages(),
            ],
        ]);
    }

    /** Order lines this vendor has to fulfil. */
    public function orders(Request $request)
    {
        $vendor = $this->vendor($request);

        if (! $vendor) {
            return response()->json(['message' => 'This account is not a seller account.'], 403);
        }

        $query = Order::query()
            ->with(['buyer:id,name,phone', 'product:id,name', 'product.images'])
            ->where('vendor_id', $vendor->id);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $orders = $query->latest('id')->paginate(min((int) $request->query('per_page', 25), 60));

        return response()->json([
            'orders' => collect($orders->items())->map(fn (Order $order) => [
                'id'         => $order->id,
                'reference'  => $order->reference,
                'status'     => $order->status,
                'quantity'   => (int) $order->quantity,
                'price'      => (float) $order->price,
                'total'      => (float) $order->total,
                'placed_at'  => optional($order->created_at)->toIso8601String(),
                'customer'   => [
                    'name'  => $order->buyer->name ?? 'Customer',
                    'phone' => $order->customer_phone ?? $order->buyer->phone ?? null,
                ],
                'address'    => $order->delivery_address,
                'product'    => $order->product ? [
                    'id'    => $order->product->id,
                    'name'  => $order->product->name,
                    'image' => Media::url(optional($order->product->images->first())->image),
                ] : null,
            ])->values(),
            'meta' => [
                'total'        => $orders->total(),
                'current_page' => $orders->currentPage(),
                'last_page'    => $orders->lastPage(),
                'has_more'     => $orders->hasMorePages(),
            ],
        ]);
    }

    /**
     * Move one of the vendor's own order lines forward.
     * Cancelling returns the reserved units to stock.
     */
    public function updateOrderStatus(Request $request, int $orderId)
    {
        $vendor = $this->vendor($request);

        if (! $vendor) {
            return response()->json(['message' => 'This account is not a seller account.'], 403);
        }

        $data = $request->validate([
            'status' => 'required|in:processing,shipped,completed,cancelled',
        ]);

        // Scoping by vendor_id is the authorisation check: a seller simply
        // cannot address another seller's order line.
        $order = Order::where('id', $orderId)->where('vendor_id', $vendor->id)->first();

        if (! $order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        if (in_array($order->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'This order is already closed.'], 422);
        }

        DB::transaction(function () use ($order, $data) {
            if ($data['status'] === 'cancelled') {
                Product::where('id', $order->product_id)->increment('stock', $order->quantity);
            }

            $order->update(['status' => $data['status']]);
        });

        return response()->json(['message' => 'Order updated.', 'status' => $data['status']]);
    }

    /* ---------------------------------------------------------------- */

    /** Daily revenue for the last 30 days, gap-filled. */
    private function salesTrend(int $vendorId): array
    {
        $rows = Order::query()
            ->where('vendor_id', $vendorId)
            ->whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', now()->subDays(30))
            ->select(DB::raw('DATE(created_at) AS day'), DB::raw('SUM(total) AS total'))
            ->groupBy('day')
            ->pluck('total', 'day');

        $series = [];
        for ($offset = 29; $offset >= 0; $offset--) {
            $day = now()->subDays($offset)->toDateString();
            $series[] = [
                'date'  => $day,
                'total' => (float) ($rows[$day] ?? 0),
            ];
        }

        return $series;
    }

    /** Best sellers by units moved. */
    private function topProducts(int $vendorId): array
    {
        return Order::query()
            ->where('orders.vendor_id', $vendorId)
            ->whereNotIn('orders.status', ['cancelled'])
            ->join('products', 'products.id', '=', 'orders.product_id')
            ->select(
                'products.id',
                'products.name',
                DB::raw('SUM(orders.quantity) AS units'),
                DB::raw('SUM(orders.total) AS revenue')
            )
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('units')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'id'      => (int) $row->id,
                'name'    => $row->name,
                'units'   => (int) $row->units,
                'revenue' => (float) $row->revenue,
            ])
            ->values()
            ->all();
    }
}
