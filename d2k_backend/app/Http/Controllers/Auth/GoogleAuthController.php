<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\FirebaseIdTokenVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Google sign-in for customers, via Firebase Authentication.
 *
 * The client performs Google sign-in through Firebase and sends the resulting
 * Firebase ID token. Firebase is the identity provider; Sanctum remains the
 * application's session mechanism, so nothing downstream of this endpoint
 * changes.
 *
 * Deliberately customer-only. A vendor, admin or staff account is never
 * created here and never logged into here: privileged accounts keep their
 * existing password flow, where approval and role checks already live. Letting
 * a Google token open an admin session would move that decision to Google.
 *
 * The response is byte-for-byte the shape `/api/login` returns, so every
 * existing client — web store, Flutter app — handles it with no special case.
 */
class GoogleAuthController extends Controller
{
    public function __construct(private readonly FirebaseIdTokenVerifier $verifier)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id_token' => ['required', 'string'],
        ]);

        try {
            $profile = $this->verifier->verify($data['id_token']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 401);
        }

        // One transaction so two taps on a slow connection cannot race into two
        // accounts for the same person.
        $result = DB::transaction(function () use ($profile) {
            $user = User::where('firebase_uid', $profile['uid'])->first();

            if (! $user) {
                // The email is trusted only because Google verified it and we
                // verified Google's signature.
                $user = User::where('email', $profile['email'])->lockForUpdate()->first();
            }

            if ($user) {
                // A privileged account is not reachable through the customer
                // Google flow, even when the email genuinely matches. The person
                // may well be the owner — they sign in with their password,
                // where the vendor-approval and role checks apply.
                if ($user->role !== 'user') {
                    return ['error' => [
                        'message' => 'This email belongs to a seller or staff account. '
                            . 'Please sign in with your email and password.',
                        'status'  => 409,
                    ]];
                }

                // Link on first Google sign-in for an existing customer. Their
                // orders, cart, addresses and profile are untouched.
                if (! $user->firebase_uid) {
                    $user->firebase_uid = $profile['uid'];
                }

                if (! $user->avatar_url && $profile['picture']) {
                    $user->avatar_url = $profile['picture'];
                }

                // Google has verified the address, so an account that signed up
                // with the same email is verified by transitivity.
                $user->email_verified_at ??= now();
                $user->save();

                return ['user' => $user];
            }

            return ['user' => User::create([
                'name'              => $profile['name'] !== '' ? $profile['name'] : 'D2K Shopper',
                'email'             => $profile['email'],
                'firebase_uid'         => $profile['uid'],
                'avatar_url'        => $profile['picture'],
                // Role is hard-coded, never taken from the request: this
                // endpoint can only ever produce a customer.
                'role'              => 'user',
                'password'          => null,
                'email_verified_at' => now(),
            ])];
        });

        if (isset($result['error'])) {
            return response()->json(
                ['message' => $result['error']['message']],
                $result['error']['status'],
            );
        }

        $user = $result['user'];

        return response()->json([
            'user'  => $user->load('vendor'),
            'token' => $user->createToken('api-token')->plainTextToken,
        ]);
    }
}
