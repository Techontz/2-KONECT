<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Services\AzamPayClient;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class SubscriptionController extends Controller
{
    /** POST /api/subscriptions/checkout (auth:sanctum) */
    public function checkout(Request $req, AzamPayClient $az)
    {
        $user = $req->user();

        $data = $req->validate([
            'plan'     => ['required', Rule::in(['basic','pro','enterprise'])],
            'provider' => ['required', Rule::in(['Airtel','Tigo','Halopesa','Azampesa','Mpesa'])],
            'msisdn'   => ['required','string','min:10','max:15'],
        ]);

        // Normalize 07xxxxxxxx -> 2557xxxxxxxx
        $msisdn = preg_replace('/\D/', '', $data['msisdn']);
        if (strlen($msisdn) === 10 && str_starts_with($msisdn, '0')) {
            $msisdn = '255' . substr($msisdn, 1);
        }

        $amount = (int) data_get(config('azampay.plans'), "{$data['plan']}.amount");
        if (!$amount) {
            return response()->json(['message' => 'Plan not configured'], 422);
        }

        $externalId = (string) Str::uuid();

        $sub = Subscription::create([
            'user_id'     => $user->id,
            'plan'        => $data['plan'],
            'amount'      => $amount,
            'currency'    => 'TZS',
            'provider'    => $data['provider'],
            'msisdn'      => $msisdn,
            'external_id' => $externalId,
            'status'      => 'pending',
        ]);

        $payload = [
            'accountNumber' => $msisdn,
            'amount'        => $amount,
            'currency'      => 'TZS',
            'externalId'    => $externalId,
            'provider'      => $data['provider'],
        ];

        try {
            $resp = $az->mnoCheckout($payload);

            if (!empty($resp['transactionId'])) {
                $sub->update(['transaction_id' => $resp['transactionId']]);
            }

            return response()->json([
                'message'       => $resp['message'] ?? 'Approve on your phone.',
                'externalId'    => $externalId,
                'transactionId' => $resp['transactionId'] ?? null,
                'success'       => $resp['success'] ?? null,
                'status'        => $sub->status,
            ]);
        } catch (\Throwable $e) {
            Log::error('Subscription checkout failed', ['error' => $e->getMessage()]);
            $sub->update(['status' => 'failed', 'meta' => ['error' => $e->getMessage()]]);
            return response()->json([
                'message' => 'Payment init failed',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /** PUBLIC: POST /api/v1/Checkout/Callback (AzamPay posts here) */
    public function callback(Request $req)
    {
        // Expected fields: msisdn, amount, message, utilityref(externalId), operator, reference, transactionstatus, fspReferenceId
        $externalId = $req->input('utilityref');

        if (!$externalId) return response()->json(['ok' => true]);

        $sub = Subscription::where('external_id', $externalId)->first();
        if (!$sub) return response()->json(['ok' => true]);

        $status = strtolower($req->input('transactionstatus', ''));

        if ($status === 'success') {
            $sub->update([
                'status'         => 'paid',
                'transaction_id' => $req->input('reference', $sub->transaction_id),
                'meta'           => [
                    'message' => $req->input('message'),
                    'operator'=> $req->input('operator'),
                    'fspRef'  => $req->input('fspReferenceId'),
                ],
                'starts_at'  => now(),
                'expires_at' => Carbon::now()->addDays((int) config('azampay.duration_days', 30)),
            ]);
        } else {
            $sub->update([
                'status' => 'failed',
                'meta'   => array_merge($sub->meta ?? [], [
                    'message' => $req->input('message'),
                    'operator'=> $req->input('operator'),
                    'fspRef'  => $req->input('fspReferenceId'),
                ]),
            ]);
        }

        return response()->json(['ok' => true]); // 200 required
    }

    /** GET /api/subscriptions/{externalId} (auth:sanctum) */
    public function status(string $externalId)
    {
        $sub = Subscription::where('external_id', $externalId)->firstOrFail();

        return response()->json([
            'status'        => $sub->status,
            'plan'          => $sub->plan,
            'transactionId' => $sub->transaction_id,
            'expiresAt'     => $sub->expires_at,
        ]);
    }

    /** TEMP: GET /api/azampay/auth-ping (for debugging) */
    public function authPing(AzamPayClient $az)
    {
        try {
            $token = $az->getAccessToken();
            return response()->json(['ok' => true, 'token_preview' => substr($token, 0, 14) . '...']);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
