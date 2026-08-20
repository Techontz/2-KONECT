<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Resolve the caller if they happen to be signed in, and carry on if not.
 *
 * Some things on 2KONECT are open to everybody but better when we know who is
 * asking — a sourcing request from a signed-in shopper belongs in their
 * dashboard, the same request from a visitor is still perfectly valid. The
 * `auth:sanctum` middleware cannot express that: it rejects. This resolves the
 * bearer token when one is present and never rejects.
 */
class OptionalAuth
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->bearerToken() && ! $request->user()) {
            // `userResolver` is what `$request->user()` reads, so setting it
            // here makes the caller visible to controllers downstream.
            $user = Auth::guard('sanctum')->user();

            if ($user) {
                $request->setUserResolver(fn () => $user);
            }
        }

        return $next($request);
    }
}
