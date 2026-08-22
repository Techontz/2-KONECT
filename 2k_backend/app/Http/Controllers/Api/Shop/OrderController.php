<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\DeliveryRequest;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductVariant;
use App\Support\Media;
use App\Support\OrderJourney;
use App\Support\Pricing;
use App\Support\Sourcing;
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
            // Which way the buyer chose to buy it: local stock or imported.
            // Absent means the product's own primary offer.
            'items.*.offer_id'     => 'nullable|integer|exists:product_offers,id',
            // Which combination, when the product has any. Absent means the
            // product itself, which is every existing listing.
            'items.*.variant_id'   => 'nullable|integer|exists:product_variants,id',
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
                    $product = Product::with('priceTiers')->lockForUpdate()->find($item['product_id']);

                    if (! $product) {
                        abort(422, 'A product in your cart is no longer available.');
                    }

                    // Resolve which offer is being bought. An alternative offer
                    // has to belong to this product and still be live, or the
                    // buyer could be quoted a price that is not on sale here.
                    $offer = null;
                    if (! empty($item['offer_id'])) {
                        $offer = ProductOffer::where('id', $item['offer_id'])
                            ->where('product_id', $product->id)
                            ->where('is_active', true)
                            ->lockForUpdate()
                            ->first();

                        if (! $offer) {
                            abort(422, 'That buying option is no longer available.');
                        }
                    }

                    // Resolve the combination, if one was named. It has to
                    // belong to this product and still be live, or a shopper
                    // could post the id of a variant from another listing.
                    $variant = null;
                    if (! empty($item['variant_id'])) {
                        // The exact variant, with its option rows, so the
                        // labels can be frozen onto the order below. One
                        // query for the one combination being bought — never
                        // the product's whole matrix.
                        $variant = ProductVariant::with('options.attribute', 'options.attributeValue')
                            ->where('id', $item['variant_id'])
                            ->where('product_id', $product->id)
                            ->where('is_active', true)
                            ->lockForUpdate()
                            ->first();

                        if (! $variant) {
                            abort(422, 'That option is no longer available.');
                        }
                    } elseif ($product->variants()->where('is_active', true)->exists()) {
                        // The product sells by combination and none was chosen.
                        // Falling through would charge the product's own price
                        // for stock that is only tracked per variant.
                        abort(422, sprintf('Choose an option for "%s" before checking out.', $product->name));
                    }

                    // The price and the stock ceiling both come from the
                    // database here — variant, then offer, then the product —
                    // with the quantity tier applied on top. Nothing the
                    // browser sent about price is read.
                    $quote = Pricing::resolve($product, $offer, $variant, (int) $item['quantity']);

                    $availability = $quote['availability'];
                    $unitPrice    = $quote['unit_price'];

                    if (! $quote['purchasable']) {
                        abort(422, $quote['reason'] ?? 'That item is no longer available.');
                    }

                    $sourcing = Sourcing::payload(
                        $availability,
                        $offer?->source_country ?? $product->source_country,
                        $offer?->lead_time_min_days ?? $product->lead_time_min_days,
                        $offer?->lead_time_max_days ?? $product->lead_time_max_days,
                        $offer?->shipping_method ?? $product->shipping_method,
                        $offer?->fulfilment_location ?? $product->fulfilment_location,
                    );

                    $lineTotal = $unitPrice * $item['quantity'];
                    $subtotal += $lineTotal;

                    $lines[] = Order::create([
                        'reference'        => $reference,
                        'user_id'          => $user->id,
                        'vendor_id'        => $offer?->vendor_id ?? $product->vendor_id,
                        'product_id'       => $product->id,
                        'offer_id'         => $offer?->id,
                        'product_variant_id' => $variant?->id,
                        // Words, not ids: the order has to survive the listing
                        // being reconfigured underneath it.
                        'variant_options'    => $variant?->optionSnapshot(),
                        'quantity'         => $item['quantity'],
                        'price'            => $unitPrice,
                        'total'            => $lineTotal,
                        'status'           => 'pending',
                        'payment_method'   => $data['payment_method'],
                        'payment_provider' => $data['payment_provider'] ?? null,
                        'delivery_address' => $data['delivery_address'],
                        'customer_phone'   => $data['customer_phone'],
                        'external_id'      => (string) Str::uuid(),
                        // The promise made at checkout is stored on the order,
                        // so editing the listing later cannot silently rewrite
                        // what the buyer was told.
                        'fulfilment_type'      => $availability,
                        'source_country'       => $sourcing['origin']['code'] ?? null,
                        'shipping_method'      => $sourcing['shipping_method']['code'] ?? null,
                        'eta_min_days'         => $sourcing['lead_time']['min'],
                        'eta_max_days'         => $sourcing['lead_time']['max'],
                        'estimated_arrival_at' => now()->addDays($sourcing['lead_time']['max'])->toDateString(),
                    ]);

                    // Reserve the stock that was just sold, from whichever
                    // row is actually counting it. A variant tracks its own,
                    // so it is decremented even for an import: the units exist
                    // as a specific combination, unlike an import of the
                    // product itself which is bought in per order.
                    if ($variant) {
                        $variant->decrement('stock', $item['quantity']);
                    } elseif ($availability === Sourcing::LOCAL) {
                        $offer
                            ? $offer->decrement('stock', $item['quantity'])
                            : $product->decrement('stock', $item['quantity']);
                    }
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

        // Open the journey. Tracking reads recorded events, so a step is only
        // ever shown as done because it actually happened.
        OrderEvent::create([
            'reference'   => $reference,
            'order_id'    => $first->id,
            'status'      => OrderJourney::PENDING,
            'title'       => OrderJourney::label(OrderJourney::PENDING),
            'note'        => $data['payment_method'] === 'cash_on_delivery'
                ? 'Order received. Payment on delivery.'
                : 'Order received. Awaiting payment confirmation.',
            'happened_at' => now(),
        ]);

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

        DB::transaction(function () use ($lines, $reference) {
            foreach ($lines as $line) {
                // Put the reserved units back where they were taken from, so
                // this mirrors the reservation above exactly. Imports of the
                // product itself never held any — they were to be bought in —
                // so there is nothing to return.
                if ($line->product_variant_id) {
                    ProductVariant::where('id', $line->product_variant_id)->increment('stock', $line->quantity);
                } elseif ($line->fulfilment_type !== Sourcing::IMPORT) {
                    $line->offer_id
                        ? ProductOffer::where('id', $line->offer_id)->increment('stock', $line->quantity)
                        : Product::where('id', $line->product_id)->increment('stock', $line->quantity);
                }

                $line->update(['status' => 'cancelled']);
            }

            OrderEvent::create([
                'reference'   => $reference,
                'order_id'    => $lines->first()->id,
                'status'      => OrderJourney::CANCELLED,
                'title'       => OrderJourney::label(OrderJourney::CANCELLED),
                'note'        => 'Cancelled at your request.',
                'happened_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Order cancelled.']);
    }

    /* ---------------------------------------------------------------- */

    private function newReference(): string
    {
        do {
            $reference = '2K-' . strtoupper(Str::random(8));
        } while (Order::where('reference', $reference)->exists());

        return $reference;
    }

    /**
     * The last-mile job attached to this order, if one has been asked for.
     *
     * Shaped by the model rather than here: this page and the deliveries list
     * were building the same object separately, and this copy was missing
     * `status_label`, so the order page printed "2KONECT Rides · undefined"
     * beside a real delivery.
     */
    private function deliveryRequestPayload(string $reference): ?array
    {
        return DeliveryRequest::where('order_reference', $reference)
            ->whereNotIn('status', ['cancelled'])
            ->latest('id')
            ->first()
            ?->payload();
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
        $first  = $lines->first();
        $status = $this->rollUpStatus($lines);

        $subtotal = (float) $lines->sum('total');
        $delivery = (float) $lines->sum('delivery_fee');

        // An order is an import the moment any part of it has to travel.
        $isImport = $lines->contains(fn ($line) => $line->fulfilment_type === Sourcing::IMPORT);
        $type     = $isImport ? Sourcing::IMPORT : Sourcing::LOCAL;

        // The whole order is only there when its slowest line is.
        $arrival = $lines->pluck('estimated_arrival_at')->filter()->max();
        $etaMin  = (int) ($lines->max('eta_min_days') ?: 0);
        $etaMax  = (int) ($lines->max('eta_max_days') ?: 0);

        $events = OrderEvent::where('reference', $first->reference)
            ->orderBy('happened_at')
            ->get();

        $landed = OrderJourney::hasLanded($status, $type);

        return [
            'reference'        => $first->reference,
            'status'           => $status,
            'status_label'     => OrderJourney::label($status),

            // Where it is coming from, when it is promised, and how far along
            // the journey it actually is.
            'fulfilment' => [
                'type'        => $type,
                'is_local'    => ! $isImport,
                'label'       => $isImport ? 'International order' : 'Local delivery',
                'origin'      => Sourcing::country($lines->firstWhere('fulfilment_type', Sourcing::IMPORT)?->source_country)
                    ?? Sourcing::country($first->source_country),
                'destination' => Sourcing::country(Sourcing::HOME_COUNTRY),
                'eta' => $etaMax > 0 ? [
                    'min'   => $etaMin,
                    'max'   => $etaMax,
                    'label' => Sourcing::window($etaMin ?: $etaMax, $etaMax),
                ] : null,
                'estimated_arrival_at' => $arrival
                    ? \Illuminate\Support\Carbon::parse($arrival)->toDateString()
                    : null,
                'tracking_number' => $first->tracking_number,
                'carrier'         => $first->carrier,
                'shipping_method' => $first->shipping_method
                    ? (Sourcing::SHIPPING_METHODS[$first->shipping_method]['label'] ?? $first->shipping_method)
                    : null,
            ],

            'timeline' => OrderJourney::timeline($status, $type, $events),

            // What the buyer may do next, decided here rather than re-derived
            // from status strings in the frontend.
            'can_cancel' => $lines->every(
                fn ($line) => in_array($line->status, ['pending', 'processing'], true)
            ),
            'can_request_delivery' => $landed
                && OrderJourney::isOpen($status)
                && ! DeliveryRequest::where('order_reference', $first->reference)
                    ->whereNotIn('status', ['cancelled'])
                    ->exists(),
            'delivery_request' => $this->deliveryRequestPayload($first->reference),

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
                // The combination that was bought, in the words it was bought
                // under. Read from the order's own snapshot, never looked up
                // against today's configuration.
                'options'  => $line->variant_options ?: null,
                'total'    => (float) $line->total,
                'status'   => $line->status,
                'sourcing' => Sourcing::payload(
                    $line->fulfilment_type,
                    $line->source_country,
                    $line->eta_min_days,
                    $line->eta_max_days,
                    $line->shipping_method,
                    null,
                ),
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
        $statuses = $lines->pluck('status')->unique();

        if ($statuses->count() === 1) {
            return $statuses->first();
        }

        // Ignore cancelled lines when the rest of the order is still live.
        $live = $statuses->reject(fn ($s) => in_array($s, ['cancelled', 'refunded'], true));

        if ($live->isEmpty()) {
            return $statuses->contains('refunded') ? 'refunded' : 'cancelled';
        }

        // Rank by position on the import route, which contains every stop the
        // local one does. An unknown status sorts last so a line the seller
        // console has moved somewhere unexpected cannot claim the order is
        // further along than it is.
        $route = array_flip(OrderJourney::path(Sourcing::IMPORT));

        return $live->sortBy(fn ($s) => $route[$s] ?? 99)->first();
    }
}
