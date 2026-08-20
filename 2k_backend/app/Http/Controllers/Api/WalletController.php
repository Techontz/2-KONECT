<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * The seller's wallet: what they have earned and what they have asked for.
 *
 * Payouts are requested through WithdrawalController, which is what the route
 * points at — this used to carry a second, near-identical copy of that method
 * which nothing could reach.
 */
class WalletController extends Controller
{
    /** GET /api/vendor/wallet */
    public function balance(Request $request)
    {
        $vendor = $request->user()->vendor;

        if (! $vendor) {
            return response()->json(['message' => 'This account is not a seller account.'], 403);
        }

        // Read the wallet and the payouts fresh rather than through whatever
        // the vendor model happens to have cached: this endpoint is polled
        // right after a payout is requested, and a stale relation would show
        // the seller money they no longer have.
        $vendor->load(['wallet', 'withdrawals']);

        // A seller with no wallet row yet has earned nothing — that is a zero
        // balance, not an error, and the console renders it the same way.
        return response()->json([
            'balance'  => (float) ($vendor->wallet->balance ?? 0),
            'currency' => 'TZS',
            'payouts'  => $vendor->withdrawals()
                ->latest('id')
                ->limit(50)
                ->get()
                ->map(fn ($payout) => [
                    'id'             => $payout->id,
                    'amount'         => (float) $payout->amount,
                    'method'         => $payout->method,
                    'account_number' => $payout->account_number,
                    'status'         => $payout->status,
                    'requested_at'   => optional($payout->created_at)->toIso8601String(),
                ])
                ->values(),
            // Kept for the Flutter app, which reads `transactions`.
            'transactions' => $vendor->withdrawals,
        ]);
    }
}
