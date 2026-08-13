<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Wallet;

class WithdrawalController extends Controller
{
    public function requestWithdrawal(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1000', // Minimum withdrawal 1000 TZS
        ]);

        $vendor = $request->user()->vendor;
        if (!$vendor) {
            return response()->json(['message' => 'You are not a vendor'], 403);
        }

        $wallet = $vendor->wallet;
        if (!$wallet || $wallet->balance < $request->amount) {
            return response()->json(['message' => 'Insufficient balance'], 400);
        }

        $wallet->decrement('balance', $request->amount);

        // TODO: Process withdrawal via bank/mobile money
        return response()->json(['message' => 'Withdrawal request received. Processing...']);
    }
}
