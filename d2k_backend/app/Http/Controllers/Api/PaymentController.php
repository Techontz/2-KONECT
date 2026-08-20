<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\Product;
use App\Models\Wallet;
use App\Models\CartItem;
use App\Services\AzamPayClient;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
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
        $reference = '2K-' . strtoupper(Str::random(8));

        DB::beginTransaction();

        try {
            $grandTotal = 0;
            $groupedOrders = [];

            // Group items by vendor
            $vendorGroups = [];
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $vendorGroups[$product->vendor_id][] = $item;
            }

            foreach ($vendorGroups as $vendorId => $items) {
                foreach ($items as $item) {
                    $product = Product::lockForUpdate()->findOrFail($item['product_id']);

                    if ($product->stock < $item['quantity']) {
                        throw new \Exception("Not enough stock for {$product->name}");
                    }

                    $total = $product->new_price * $item['quantity'];
                    $grandTotal += $total;

                    $order = Order::create([
                        'reference'        => $reference,
                        'user_id'          => $user->id,
                        'vendor_id'        => $product->vendor_id,
                        'product_id'       => $product->id,
                        'quantity'         => $item['quantity'],
                        'price'            => $product->new_price,
                        'total'            => $total,
                        'external_id'      => $externalId,
                        // Was written as `payment_method` against a column named
                        // `payment_provider`, so the provider was silently lost
                        // on every order ever placed.
                        'payment_method'   => 'mobile_money',
                        'payment_provider' => $request->provider,
                        'status'           => 'pending',
                    ]);

                    // The stock was checked above but never reduced, so items
                    // could be oversold indefinitely.
                    $product->decrement('stock', $item['quantity']);

                    $groupedOrders[$vendorId][] = $order;
                }
            }

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
     */
    public function azampayCallback(Request $request)
    {
        Log::info('AzamPay CALLBACK', $request->all());

        $orders = Order::where('external_id', $request->input('utilityref'))->get();
        if ($orders->isEmpty()) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        $status = strtolower($request->input('transactionstatus'));

        if ($status === 'success') {
            foreach ($orders as $order) {
                $order->update(['status' => 'paid']);
                $order->product->decrement('stock', $order->quantity);

                $wallet = Wallet::firstOrCreate(['vendor_id' => $order->vendor_id]);
                $wallet->increment('balance', $order->total);
            }
        } else {
            foreach ($orders as $order) {
                $order->update(['status' => 'failed']);
            }
        }

        return response()->json(['message' => 'Callback processed successfully.']);
    }

    /**
     * 💰 Confirm Manual Payment (previously Lipa Namba)
     * Used when customer pays manually to vendors
     */
    public function confirmManualPayment(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'total' => 'required|numeric|min:1',
            'reference' => 'nullable|string',
        ]);

        DB::beginTransaction();

        try {
            $groupedOrders = [];
            $vendorGroups = [];

            // Group products by vendor
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $vendorGroups[$product->vendor_id][] = $item;
            }

            foreach ($vendorGroups as $vendorId => $items) {
                foreach ($items as $item) {
                    $product = Product::lockForUpdate()->findOrFail($item['product_id']);
                    $total = $product->new_price * $item['quantity'];

                    $order = Order::create([
                        'user_id'        => $user->id,
                        'vendor_id'      => $vendorId,
                        'product_id'     => $product->id,
                        'quantity'       => $item['quantity'],
                        'price'          => $product->new_price,
                        'total'          => $total,
                        'payment_method' => 'Manual Payment',
                        'reference'      => $request->reference ?? 'ManualConfirm',
                        'status'         => 'pending',
                    ]);

                    $product->decrement('stock', $item['quantity']);

                    // Vendor wallet increments manually once vendor confirms delivery
                    $groupedOrders[$vendorId][] = $order;
                }
            }

            DB::commit();

            CartItem::where('user_id', $user->id)->delete();

            return response()->json([
                'message' => 'Manual payment confirmed and orders placed successfully.',
                'orders'  => $groupedOrders,
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

    public function approveOrder($id)
    {
        $order = Order::findOrFail($id);

        if (!in_array($order->status, ['pending', 'paid'])) {
            return response()->json(['message' => 'Order not in pending or paid state.'], 400);
        }

        $order->update(['status' => 'processing']);

        return response()->json(['message' => 'Order accepted and now processing.']);
    }

    public function completeOrder($id)
    {
        $order = Order::findOrFail($id);

        if ($order->status !== 'processing') {
            return response()->json(['message' => 'Order not in processing state.'], 400);
        }

        $order->update(['status' => 'completed']);

        // When vendor marks as complete, add to wallet
        $wallet = Wallet::firstOrCreate(['vendor_id' => $order->vendor_id]);
        $wallet->increment('balance', $order->total);

        return response()->json(['message' => 'Order marked as completed and credited.']);
    }

    public function cancelOrder($id)
    {
        $order = Order::findOrFail($id);

        if (in_array($order->status, ['completed', 'cancelled', 'refunded'])) {
            return response()->json(['message' => 'Order already closed.'], 400);
        }

        $order->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Order cancelled successfully.']);
    }

    public function refundOrder($id)
    {
        $order = Order::findOrFail($id);

        if (!in_array($order->status, ['processing', 'completed', 'paid'])) {
            return response()->json(['message' => 'Order not eligible for refund.'], 400);
        }

        $order->update(['status' => 'refunded']);

        $wallet = Wallet::firstOrCreate(['vendor_id' => $order->vendor_id]);
        if ($wallet->balance >= $order->total) {
            $wallet->decrement('balance', $order->total);
        }

        return response()->json(['message' => 'Order refunded successfully.']);
    }

    public function previewVendors(Request $request)
    {
        \Log::info('PreviewVendors Request:', $request->all()); 
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

                $vendor->load(['paymentOptions.paymentMethod:id,name']);
                $paymentOptions = $vendor->paymentOptions->map(function ($opt) {
                    return [
                        'id' => $opt->id,
                        'method' => $opt->paymentMethod->name ?? 'N/A',
                        'account' => $opt->account,
                    ];
                });

                $vendors[] = [
                    'vendor' => [
                        'id' => $vendor->id,
                        'name' => $vendor->business_name ?? $vendor->user->name ?? 'Unnamed Vendor',
                        'payment_options' => $paymentOptions,
                    ],
                    'items' => $items,
                    'total' => $total,
                ];
            }

            return response()->json(['vendors' => $vendors]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }        
    }

}
