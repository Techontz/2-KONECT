<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Withdrawal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WithdrawalController extends Controller
{
    /**
     * Ask for a payout.
     *
     * The balance is debited and the request is written down in the same
     * transaction. Previously only the debit happened: a seller's balance fell
     * and nothing anywhere recorded that money was owed to them, so a payout
     * could not be traced, queried or paid.
     */
    public function requestWithdrawal(Request $request)
    {
        $data = $request->validate([
            'amount'         => 'required|numeric|min:1000', // Minimum payout, TZS.
            'method'         => 'required|string|max:40',
            'account_number' => 'required|string|max:40',
        ]);

        $vendor = $request->user()->vendor;

        if (! $vendor) {
            return response()->json(['message' => 'You are not a vendor'], 403);
        }

        $wallet = $vendor->wallet;

        if (! $wallet) {
            return response()->json(['message' => 'No wallet found'], 404);
        }

        try {
            $withdrawal = DB::transaction(function () use ($wallet, $vendor, $data) {
                // Re-read under a lock: two requests racing must not both pass
                // the balance check and overdraw the wallet between them.
                $locked = $wallet->newQuery()->lockForUpdate()->find($wallet->id);

                if ((float) $locked->balance < (float) $data['amount']) {
                    abort(400, 'Insufficient balance');
                }

                $locked->decrement('balance', $data['amount']);

                return Withdrawal::create([
                    'vendor_id'      => $vendor->id,
                    'amount'         => $data['amount'],
                    'method'         => $data['method'],
                    'account_number' => $data['account_number'],
                    'status'         => 'pending',
                ]);
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        }

        return response()->json([
            'message'    => 'Withdrawal request received. Processing...',
            'withdrawal' => $withdrawal,
        ]);
    }
}
