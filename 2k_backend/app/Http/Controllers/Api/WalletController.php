<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Wallet;
use App\Models\Withdrawal;

class WalletController extends Controller
{
    public function balance(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (!$vendor || !$vendor->wallet) {
            return response()->json(['balance' => 0]);
        }
        return response()->json([
            'balance' => $vendor->wallet->balance,
            'transactions' => $vendor->withdrawals
        ]);
    }

    public function withdraw(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1000',
            'method' => 'required|string',
            'account_number' => 'required|string',
        ]);

        $vendor = $request->user()->vendor;

        if (!$vendor || !$vendor->wallet) {
            return response()->json(['message' => 'No wallet found'], 404);
        }

        if ($request->amount > $vendor->wallet->balance) {
            return response()->json(['message' => 'Insufficient balance'], 400);
        }

        // Reduce wallet immediately
        $vendor->wallet->decrement('balance', $request->amount);

        $withdrawal = Withdrawal::create([
            'vendor_id' => $vendor->id,
            'amount' => $request->amount,
            'method' => $request->method,
            'account_number' => $request->account_number,
            'status' => 'pending'
        ]);

        return response()->json([
            'message' => 'Withdrawal request submitted',
            'withdrawal' => $withdrawal
        ]);
    }
}
