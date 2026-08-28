<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\CartItem;
use App\Models\CheckoutPaymentChannel;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\Product;
use App\Models\Wallet;
use App\Services\AzamPay\CallbackProcessor;
use App\Services\AzamPayClient;
use App\Support\CheckoutPolicy;
use App\Support\OrderJourney;
use App\Support\OrderReference;
use App\Support\Pricing;
use App\Support\Sourcing;
use App\Support\StockReservation;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * The legacy checkout surface: AzamPay mobile money, and manual confirmation.
 *
 * Nothing in this repository calls any of it. The website checks out through
 * `POST /api/shop/orders`, the current Flutter app does the same, and the
 * retired one never had these endpoints in its source either. It is registered
 * only when `azampay.enabled` is on, which it is not by default.
 *
 * It is kept, hardened, rather than deleted, because the AzamPay integration
 * itself is real work and mobile money is the obvious next channel. But it now
 * obeys the same rules as the storefront checkout instead of quietly having
 * its own — the divergence was not stylistic, it was a way around the one rule
 * the marketplace cannot afford to lose:
 *
 *   an imported order is paid for before it is bought.
 *
 * Orders created here used to carry neither `fulfilment_type` nor
 * `payment_status`, so they took the column defaults — `local`, and
 * `not_required`. `not_required` means cash on delivery. An imported product
 * bought through this controller was therefore an import that owed nothing,
 * which is precisely what `CheckoutPolicy` exists to make impossible.
 */
class PaymentController extends Controller
{
    /**
     * What `payment_method` a manually-confirmed order carries.
     *
     * Kept as the exact string historic rows already hold, so order history
     * does not split into two spellings of the same thing.
     */
    public const MANUAL_METHOD = 'Manual Payment';

    /**
     * 📱 Mobile Money Checkout (AzamPay)
     * Handles M-Pesa / Airtel / Tigo / Halo payments
     * Groups products by vendor automatically
     */
    public function checkout(Request $request, AzamPayClient $azamPay)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'phone' => 'required|string',
            'provider' => 'required|string',
        ]);

        $user = $request->user();
        $externalId = (string) Str::uuid();
        // Human-quotable order number shared by every line in this checkout.
        // Generated here and never accepted from the caller — see OrderReference.
        $reference = OrderReference::generate();

        DB::beginTransaction();

        try {
            $grandTotal = 0;
            $groupedOrders = [];
            $lines = [];

            // Group items by vendor
            $vendorGroups = [];
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $vendorGroups[$product->vendor_id][] = $item;
            }

            foreach ($vendorGroups as $vendorId => $items) {
                foreach ($items as $item) {
                    $product = Product::with('priceTiers')->lockForUpdate()->findOrFail($item['product_id']);

                    // Price and availability come from the same resolver the
                    // storefront uses. This route previously read
                    // `$product->new_price` directly, so it ignored quantity
                    // tiers and alternative offers and could charge a figure
                    // that is not on sale anywhere else on the site.
                    $quote = Pricing::resolve($product, null, null, (int) $item['quantity']);

                    if (! $quote['purchasable']) {
                        throw new \RuntimeException($quote['reason'] ?? "Not enough stock for {$product->name}");
                    }

                    $total = $quote['unit_price'] * $item['quantity'];
                    $grandTotal += $total;

                    $sourcing = Sourcing::payload(
                        $quote['availability'],
                        $product->source_country,
                        $product->lead_time_min_days,
                        $product->lead_time_max_days,
                        $product->shipping_method,
                        $product->fulfilment_location,
                    );

                    $order = Order::create([
                        'reference'        => $reference,
                        'user_id'          => $user->id,
                        'vendor_id'        => $product->vendor_id,
                        'product_id'       => $product->id,
                        'quantity'         => $item['quantity'],
                        'price'            => $quote['unit_price'],
                        'total'            => $total,
                        'external_id'      => $externalId,
                        // Was written as `payment_method` against a column named
                        // `payment_provider`, so the provider was silently lost
                        // on every order ever placed.
                        'payment_method'   => CheckoutPaymentChannel::MOBILE_MONEY,
                        'payment_provider' => $request->provider,
                        // Mobile money is prepayment: the money has not arrived
                        // until it has, and until then the order says so. This
                        // column was not written at all before, so every order
                        // from this route defaulted to `not_required` — the
                        // value that means cash on delivery.
                        'payment_status'   => CheckoutPolicy::initialPaymentStatus(
                            CheckoutPaymentChannel::MOBILE_MONEY,
                        ),
                        'status'           => 'pending',
                        // The promise made at checkout, stored on the order so
                        // editing the listing later cannot rewrite it.
                        'fulfilment_type'      => $quote['availability'],
                        'source_country'       => $sourcing['origin']['code'] ?? null,
                        'shipping_method'      => $sourcing['shipping_method']['code'] ?? null,
                        'eta_min_days'         => $sourcing['lead_time']['min'],
                        'eta_max_days'         => $sourcing['lead_time']['max'],
                        'estimated_arrival_at' => now()->addDays($sourcing['lead_time']['max'])->toDateString(),
                    ]);

                    // The stock was checked above but never reduced, so items
                    // could be oversold indefinitely. Reserved here and here
                    // only — the callback used to reduce it a second time for
                    // the same units. An import reserves nothing because there
                    // is nothing on a shelf to reserve; it is bought in.
                    if ($quote['availability'] === Sourcing::LOCAL) {
                        $product->decrement('stock', $item['quantity']);
                    }

                    $lines[] = $order;
                    $groupedOrders[$vendorId][] = $order;
                }
            }

            $first = $lines[0];

            OrderEvent::create([
                'reference'   => $reference,
                'order_id'    => $first->id,
                'status'      => OrderJourney::PENDING,
                'title'       => OrderJourney::label(OrderJourney::PENDING),
                'note'        => 'Order received. Awaiting payment.',
                'happened_at' => now(),
            ]);

            // 🔄 Initiate AzamPay Checkout for total
            $response = $azamPay->mnoCheckout([
                'accountNumber' => $request->phone,
                'amount'        => $grandTotal,
                'currency'      => 'TZS',
                'externalId'    => $externalId,
                'provider'      => $request->provider,
            ]);

            DB::commit();

            CartItem::where('user_id', $user->id)->delete();

            return response()->json([
                'message'       => 'Checkout initiated successfully.',
                'reference'     => $reference,
                'orders'        => $groupedOrders,
                'grand_total'   => $grandTotal,
                'azam_response' => $response,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Checkout Error:', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * 🔔 AzamPay Callback Handler
     *
     * Records what was claimed and hands the order to a human. It cannot mark
     * anything paid, move money or move stock — see CallbackProcessor for why
     * that is not caution but the only defensible reading of an endpoint no
     * provider signs.
     *
     * Always answers 200 for a callback it has understood, including a
     * duplicate. A gateway reads a non-2xx as "try again", and retrying a
     * callback that was correctly ignored achieves nothing but load.
     */
    public function azampayCallback(Request $request, CallbackProcessor $processor)
    {
        // The body is not logged. It carries the payer's phone number, and a
        // log line is the wrong place for it; the redacted record written by
        // the processor is the auditable copy.
        Log::info('AzamPay callback received', [
            'external_id' => $request->input('utilityref'),
            'status'      => $request->input('transactionstatus'),
        ]);

        $result = $processor->handle($request->all());

        if ($result['status'] === CallbackProcessor::UNKNOWN) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json([
            'message' => 'Callback processed successfully.',
            'status'  => $result['status'],
        ]);
    }

    /**
     * 💰 Confirm Manual Payment (previously Lipa Namba)
     *
     * The customer says they have paid by hand. That is a claim, so the order
     * is created owing money and waits for an administrator — it is not, and
     * never was meant to be, a way to place an order that owes nothing.
     */
    public function confirmManualPayment(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            // `total` is accepted for backward compatibility and deliberately
            // ignored. What an order costs is decided by Pricing against the
            // product rows, never by the caller.
            'total' => 'nullable|numeric|min:1',
            // `reference` is no longer read. It used to be taken straight from
            // the request and defaulted to the literal string "ManualConfirm",
            // which put every such order into one shared, cross-account group
            // that settled together. See OrderReference.
        ]);

        // Generated, never accepted.
        $reference = OrderReference::generate();
        $externalId = (string) Str::uuid();

        DB::beginTransaction();

        try {
            $groupedOrders = [];
            $vendorGroups = [];
            $lines = [];

            // Group products by vendor
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $vendorGroups[$product->vendor_id][] = $item;
            }

            foreach ($vendorGroups as $vendorId => $items) {
                foreach ($items as $item) {
                    $product = Product::with('priceTiers')->lockForUpdate()->findOrFail($item['product_id']);

                    $quote = Pricing::resolve($product, null, null, (int) $item['quantity']);

                    if (! $quote['purchasable']) {
                        throw new \RuntimeException($quote['reason'] ?? 'That item is no longer available.');
                    }

                    // The rule, applied where the answer is first known. A
                    // manually-confirmed payment is prepayment by definition,
                    // so an import is legitimate here — but only because the
                    // order below actually records that money is owed. If this
                    // method ever stops being prepaid, this refuses it rather
                    // than letting an import through as cash on delivery.
                    if (
                        $quote['availability'] === Sourcing::IMPORT
                        && CheckoutPolicy::initialPaymentStatus(self::MANUAL_METHOD) === 'not_required'
                    ) {
                        throw new \RuntimeException(CheckoutPolicy::codRefusedMessage());
                    }

                    $total = $quote['unit_price'] * $item['quantity'];

                    $sourcing = Sourcing::payload(
                        $quote['availability'],
                        $product->source_country,
                        $product->lead_time_min_days,
                        $product->lead_time_max_days,
                        $product->shipping_method,
                        $product->fulfilment_location,
                    );

                    $order = Order::create([
                        'user_id'        => $user->id,
                        'vendor_id'      => $vendorId,
                        'product_id'     => $product->id,
                        'quantity'       => $item['quantity'],
                        'price'          => $quote['unit_price'],
                        'total'          => $total,
                        'payment_method' => self::MANUAL_METHOD,
                        // Money is owed and has not been confirmed. This was
                        // absent, so the column defaulted to `not_required` —
                        // an order that owes nothing.
                        'payment_status' => CheckoutPolicy::initialPaymentStatus(self::MANUAL_METHOD),
                        'reference'      => $reference,
                        'external_id'    => $externalId,
                        'status'         => 'pending',
                        'fulfilment_type'      => $quote['availability'],
                        'source_country'       => $sourcing['origin']['code'] ?? null,
                        'shipping_method'      => $sourcing['shipping_method']['code'] ?? null,
                        'eta_min_days'         => $sourcing['lead_time']['min'],
                        'eta_max_days'         => $sourcing['lead_time']['max'],
                        'estimated_arrival_at' => now()->addDays($sourcing['lead_time']['max'])->toDateString(),
                    ]);

                    if ($quote['availability'] === Sourcing::LOCAL) {
                        $product->decrement('stock', $item['quantity']);
                    }

                    // Vendor wallet increments manually once vendor confirms delivery
                    $lines[] = $order;
                    $groupedOrders[$vendorId][] = $order;
                }
            }

            $first = $lines[0];

            OrderEvent::create([
                'reference'   => $reference,
                'order_id'    => $first->id,
                'status'      => OrderJourney::PENDING,
                'title'       => OrderJourney::label(OrderJourney::PENDING),
                'note'        => 'Order received. Awaiting payment.',
                'happened_at' => now(),
            ]);

            DB::commit();

            CartItem::where('user_id', $user->id)->delete();

            return response()->json([
                'message'   => 'Order placed. We will confirm your payment.',
                'reference' => $reference,
                'orders'    => $groupedOrders,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Manual Payment Error:', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * 👤 Fetch User Orders
     */
    public function userOrders(Request $request)
    {
        $user = $request->user();

        $orders = Order::with(['product', 'vendor'])
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['orders' => $orders]);
    }

    /**
     * 🧾 Fetch Vendor Orders
     */
    public function vendorOrders(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'vendor') {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        $orders = Order::with(['buyer', 'product'])
            ->where('vendor_id', $user->vendor->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'vendor_id' => $user->vendor->id,
            'orders'    => $orders
        ]);
    }

    /* --------------------------------------------------------------------------
     * 🧩 VENDOR ORDER ACTIONS
     * -------------------------------------------------------------------------- */

    /**
     * The order this caller is entitled to act on.
     *
     * Every one of the four actions below used to be `Order::findOrFail($id)`
     * and nothing else. They sit behind `auth:sanctum`, so being signed in was
     * the only requirement — any customer could approve, complete, cancel or
     * refund *any* order in the marketplace by its id, and `completeOrder()`
     * credits a vendor wallet. An order id is a small integer.
     *
     * The check is the one this codebase already uses, not a new one. Scoping
     * the query by `vendor_id` *is* the authorisation, exactly as
     * `Shop\VendorController::updateOrderStatus` documents it: a seller cannot
     * address another seller's line because the query cannot return it.
     *
     * A since-deleted `VendorOrderController` (removed as dead code — it was
     * never routed) carried these same four actions and did scope them by
     * vendor, which is good evidence the omission here was an oversight rather
     * than a decision.
     *
     * Two different refusals, because they are two different facts:
     *
     *   403  you are not a seller — true regardless of which order was named
     *   404  no such order *for you* — never distinguishes "not yours" from
     *        "does not exist", so the endpoint cannot be used to enumerate
     *        which order ids are real
     *
     * An administrator passes without the vendor scope. That is the capability
     * they already hold in the admin panel, where they can move any order
     * through its journey; this does not grant anything new, it declines to
     * take it away.
     */
    private function vendorActionable(Request $request, $id, bool $lock = false): Order
    {
        $user = $request->user();
        $isAdmin = $user?->role === 'admin';

        if (! $isAdmin && ! $user?->vendor) {
            abort(403, 'This account is not a seller account.');
        }

        $query = Order::where('id', $id);

        if (! $isAdmin) {
            $query->where('vendor_id', $user->vendor->id);
        }

        // Held for the duration of the surrounding transaction, so that an
        // action which moves money reads the row nobody else can change
        // underneath it.
        if ($lock) {
            $query->lockForUpdate();
        }

        $order = $query->first();

        if (! $order) {
            abort(404, 'Order not found.');
        }

        return $order;
    }

    public function approveOrder(Request $request, $id)
    {
        $order = $this->vendorActionable($request, $id);

        // An import is bought to order. Accepting one before the customer has
        // paid commits 2KONECT to a supplier abroad against money that may
        // never arrive, which is exactly what CheckoutPolicy refuses at
        // checkout — refusing it there and permitting it here would be no
        // rule at all.
        if ($refusal = \App\Support\OrderGate::refusal($order)) {
            return response()->json(['message' => $refusal], 422);
        }

        if (!in_array($order->status, ['pending', 'paid'])) {
            return response()->json(['message' => 'Order not in pending or paid state.'], 400);
        }

        $order->update(['status' => 'processing']);

        return response()->json(['message' => 'Order accepted and now processing.']);
    }

    /**
     * Mark an order delivered and credit the seller for it.
     *
     * The credit happens exactly once. It used to happen here *and* in the
     * AzamPay callback, so an order paid by mobile money and then completed
     * normally paid the vendor twice. The callback no longer touches money at
     * all, and the re-read under a lock closes the remaining gap: two requests
     * arriving together both used to see `processing` and both credit.
     */
    public function completeOrder(Request $request, $id)
    {
        DB::transaction(function () use ($request, $id) {
            // Authorisation and the lock are taken together, inside the
            // transaction, so the row that is checked is the row that is
            // credited. Doing the check outside would leave a window in which
            // the order could change between the two.
            $order = $this->vendorActionable($request, $id, lock: true);

            // Completing credits the seller's wallet. An unpaid import must
            // never reach here — it cannot, because it could not have been
            // approved into `processing` — but the wallet is the one place
            // worth refusing twice.
            if ($refusal = \App\Support\OrderGate::refusal($order)) {
                abort(422, $refusal);
            }

            if ($order->status !== 'processing') {
                abort(400, 'Order not in processing state.');
            }

            $order->update(['status' => 'completed']);

            // When vendor marks as complete, add to wallet.
            //
            // Exactly once, guaranteed by two things together: the status gate
            // above (a completed order is no longer `processing`, so a second
            // call is refused) and the row lock (two requests arriving together
            // can no longer both read `processing` and both credit). The
            // AzamPay callback used to credit here as well, so an order paid by
            // mobile money and then completed normally paid its vendor twice;
            // that path no longer touches money at all.
            $wallet = Wallet::firstOrCreate(['vendor_id' => $order->vendor_id]);
            $wallet->increment('balance', $order->total);
        });

        return response()->json(['message' => 'Order marked as completed and credited.']);
    }

    /**
     * Withdraw an order line and return the units it was holding.
     *
     * The restoration is new here. This method changed the status and stopped,
     * so every cancellation through it quietly destroyed stock: the units were
     * decremented at checkout, the order was withdrawn, and nothing ever put
     * them back. The catalogue simply reported fewer items than the seller
     * actually had, permanently and invisibly.
     *
     * Both active paths already do this — the customer's own cancellation in
     * `Shop\OrderController::cancel` and the seller console's in
     * `Shop\VendorController::updateOrderStatus`. The rule they encode is
     * stated once in {@see StockReservation}, which is what is called here, so
     * that an import does not have local stock invented for it and a variant
     * is credited to the variant rather than to its parent product.
     *
     * The closed-status guard above is what makes restoring safe to do exactly
     * once: an already-cancelled order is refused before it can be credited a
     * second time.
     */
    public function cancelOrder(Request $request, $id)
    {
        DB::transaction(function () use ($request, $id) {
            // Locked, so that two cancellations racing cannot both pass the
            // status check and both return the same units.
            $order = $this->vendorActionable($request, $id, lock: true);

            if (in_array($order->status, ['completed', 'cancelled', 'refunded'])) {
                abort(400, 'Order already closed.');
            }

            StockReservation::restore($order);

            $order->update(['status' => 'cancelled']);

            // Record the move so the buyer's tracking timeline reflects it.
            //
            // Both active cancellation paths already do this and this one did
            // not, so an order withdrawn here went on showing as open on the
            // buyer's screen — the timeline is built from recorded events, and
            // a step nothing was written for is a step that never happened.
            //
            // The generic wording is used deliberately: this endpoint is
            // reachable by the owning seller and by an administrator, so
            // "cancelled by the seller" would sometimes be a lie.
            OrderEvent::create([
                'reference'   => $order->reference,
                'order_id'    => $order->id,
                'status'      => OrderJourney::CANCELLED,
                'title'       => OrderJourney::label(OrderJourney::CANCELLED),
                'note'        => OrderJourney::note(OrderJourney::CANCELLED),
                'happened_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Order cancelled successfully.']);
    }

    public function refundOrder(Request $request, $id)
    {
        DB::transaction(function () use ($request, $id) {
            $order = $this->vendorActionable($request, $id, lock: true);

            if (!in_array($order->status, ['processing', 'completed', 'paid'])) {
                abort(400, 'Order not eligible for refund.');
            }

            // Whether a credit was ever made for this order, read before the
            // status is overwritten.
            //
            // `completeOrder()` is the only thing that credits a wallet, and it
            // only ever runs on the way to `completed`. So a `processing` or
            // `paid` order has never been credited — and the previous code
            // debited the wallet anyway, taking the value of this order out of
            // a balance that other orders had earned. A refund reverses a
            // payment; it does not create one to reverse.
            $wasCredited = $order->status === 'completed';

            $order->update(['status' => 'refunded']);

            if ($wasCredited) {
                // The existing rule is kept exactly: only debit when the
                // balance actually covers it, rather than driving a wallet
                // negative.
                $wallet = Wallet::where('vendor_id', $order->vendor_id)->lockForUpdate()->first();

                if ($wallet && (float) $wallet->balance >= (float) $order->total) {
                    $wallet->decrement('balance', $order->total);
                }
            }
        });

        return response()->json(['message' => 'Order refunded successfully.']);
    }

    /**
     * Which sellers a basket spans, and what each part costs.
     *
     * Deliberately says nothing about how a seller is paid out. It used to
     * return `vendor_payment_options.account` — a seller's own bank or mobile
     * money account number — to any signed-in shopper who could name a
     * product. That is the seller's banking detail, it has no bearing on how
     * the customer pays 2KONECT, and nothing ever rendered it.
     */
    public function previewVendors(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        try {
            $vendorGroups = [];

            foreach ($request->items as $item) {
                $product = \App\Models\Product::with('vendor')
                    ->findOrFail($item['product_id']);
                $vendorGroups[$product->vendor_id]['vendor'] = $product->vendor;
                $vendorGroups[$product->vendor_id]['items'][] = [
                    'id' => $product->id,
                    'name' => $product->name,
                    'price' => $product->new_price,
                    'quantity' => $item['quantity'],
                ];
            }

            $vendors = [];
            foreach ($vendorGroups as $vendorId => $group) {
                $vendor = $group['vendor'];
                $items = $group['items'];

                $total = collect($items)->sum(fn($i) => $i['price'] * $i['quantity']);

                $vendors[] = [
                    'vendor' => [
                        'id' => $vendor->id,
                        'name' => $vendor->business_name ?? $vendor->user->name ?? 'Unnamed Vendor',
                    ],
                    'items' => $items,
                    'total' => $total,
                ];
            }

            return response()->json(['vendors' => $vendors]);
        } catch (\Throwable $e) {
            // The stack trace, file and line used to be returned to the caller
            // regardless of APP_DEBUG, which hands an attacker the application's
            // internal layout for free.
            Log::error('PreviewVendors failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not price that basket.'], 400);
        }
    }

}
