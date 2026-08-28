<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductCardResource;
use App\Models\Order;
use App\Models\Product;
use App\Models\Vendor;
use App\Support\Media;
use App\Support\StockReservation;
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
                'currency'       => \App\Support\Currency::BASE,
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

        // An unpaid import is not this seller's work yet, so it is not in this
        // seller's list. Excluded in the query rather than in the rendering:
        // hiding it on screen leaves it reachable by anyone who calls the
        // endpoint directly, and the console is not the only client of it.
        \App\Support\OrderGate::scopeProcessable($query);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $orders = $query->latest('id')->paginate(min((int) $request->query('per_page', 25), 60));

        return response()->json([
            'orders' => collect($orders->items())->map(fn (Order $order) => [
                'id'         => $order->id,
                'reference'  => $order->reference,
                'status'     => $order->status,
                'status_label' => \App\Support\OrderJourney::label($order->status),
                // Which route this line takes, and what moving it forward
                // means next — decided here rather than re-derived in the
                // console from a list of status strings it would have to keep
                // in step with the backend.
                'fulfilment_type' => $order->fulfilment_type ?? \App\Support\Sourcing::LOCAL,
                // The seller should never have to ask whether the customer
                // paid. Every order carries the answer and where the goods
                // come from, in the same words the admin and the buyer see.
                'origin'          => \App\Support\OrderGate::originBadge($order),
                'payment'         => \App\Support\OrderGate::paymentBadge($order),
                'next_status' => $this->nextStage($order),
                'quantity'   => (int) $order->quantity,
                // Shillings, and now labelled as such. The seller console used
                // to receive a bare number and render it with whatever symbol
                // the reader's display currency happened to be, so a
                // TZS 7,000 line read "$7,000.00" to anybody browsing in
                // dollars. A seller is paid in shillings; that is what they
                // are shown.
                'currency'   => \App\Support\Currency::BASE,
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

        // The original four remain, plus the stops an imported line makes on
        // its way in. A seller shipping locally never sees the extra ones.
        $data = $request->validate([
            'status'   => 'required|in:processing,dispatched,in_transit,arrived_tz,customs,local_warehouse,shipped,out_for_delivery,completed,cancelled',
            'note'     => 'nullable|string|max:200',
            'location' => 'nullable|string|max:120',
        ]);

        // Scoping by vendor_id is the authorisation check: a seller simply
        // cannot address another seller's order line.
        $order = Order::where('id', $orderId)->where('vendor_id', $vendor->id)->first();

        if (! $order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        // Cancelling an unpaid import is always allowed — it returns stock and
        // closes a line nobody is going to pay for. Everything else is work,
        // and work on an import waits for the money.
        if ($data['status'] !== 'cancelled' && ($refusal = \App\Support\OrderGate::refusal($order))) {
            return response()->json(['message' => $refusal], 422);
        }

        if (in_array($order->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'This order is already closed.'], 422);
        }

        DB::transaction(function () use ($order, $data) {
            // Return whatever this line was actually holding.
            //
            // This used to ask only whether the line was an import, and then
            // credit the offer or the product. It never asked about a variant —
            // so cancelling a combination made two errors at once: the units
            // came off the variant at checkout and were never given back, while
            // the parent product, which had never been decremented, gained
            // stock it does not have. Three cancelled phones lost three real
            // ones and invented three imaginary ones.
            //
            // The rule now lives in one place, including the case that made the
            // old shape wrong: a variant restores even for an import, because a
            // variant does reserve stock where an imported product does not.
            if ($data['status'] === 'cancelled') {
                StockReservation::restore($order);
            }

            $order->update(['status' => $data['status']]);

            // Record the move so the buyer's tracking timeline reflects it.
            \App\Models\OrderEvent::create([
                'reference'   => $order->reference,
                'order_id'    => $order->id,
                'status'      => $data['status'],
                'title'       => \App\Support\OrderJourney::label($data['status']),
                'note'        => $data['note'] ?? \App\Support\OrderJourney::note($data['status']),
                'location'    => $data['location'] ?? null,
                'happened_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Order updated.', 'status' => $data['status']]);
    }

    /* ---------------------------------------------------------------- */

    /**
     * The next stop on this line's own route.
     *
     * A local delivery skips the import stops entirely, so "next" is read off
     * the right path rather than hard-coded into the seller console.
     */
    private function nextStage(Order $order): ?array
    {
        if (! \App\Support\OrderJourney::isOpen($order->status)) {
            return null;
        }

        $path  = \App\Support\OrderJourney::path($order->fulfilment_type ?? \App\Support\Sourcing::LOCAL);
        $index = array_search($order->status, $path, true);
        $next  = $index === false ? null : ($path[$index + 1] ?? null);

        return $next ? ['value' => $next, 'label' => \App\Support\OrderJourney::label($next)] : null;
    }

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
