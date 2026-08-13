<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VendorOrderController extends Controller
{
    // ✅ Vendor Approves an order (marks as completed + credits wallet)
    public function approve(Request $request, $id)
    {
        $user = $request->user();

        if ($user->role !== 'vendor') {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        $order = Order::where('vendor_id', $user->vendor->id)->findOrFail($id);

        if ($order->status !== 'processing') {
            return response()->json(['message' => 'Order not in processing state.'], 400);
        }

        DB::transaction(function () use ($order) {
            $order->update(['status' => 'completed']);

            $wallet = Wallet::firstOrCreate(['vendor_id' => $order->vendor_id]);
            $wallet->increment('balance', $order->total);
        });

        return response()->json(['message' => 'Order approved successfully.', 'order' => $order]);
    }

    // ✅ Vendor Cancels an order
    public function cancel(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'vendor') return response()->json(['message' => 'Access denied.'], 403);

        $order = Order::where('vendor_id', $user->vendor->id)->findOrFail($id);
        $order->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Order cancelled.', 'order' => $order]);
    }

    // ✅ Vendor Refunds an order
    public function refund(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'vendor') return response()->json(['message' => 'Access denied.'], 403);

        $order = Order::where('vendor_id', $user->vendor->id)->findOrFail($id);
        $order->update(['status' => 'refunded']);

        return response()->json(['message' => 'Order refunded.', 'order' => $order]);
    }
}
