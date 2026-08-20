<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class LoginController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.'
            ], 401);
        }

        // Check if user is a vendor and not approved
        if ($user->role === 'vendor') {
            $vendor = $user->vendor;
            if (!$vendor || !$vendor->is_approved) {
                return response()->json([
                    'message' => 'Your account is not approved yet. Please wait for approval.'
                ], 403);
            }
        }

        // Token for API use
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'user'  => $user->load('vendor'),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }
}
