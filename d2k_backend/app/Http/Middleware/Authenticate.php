<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Auth\AuthenticationException;

class Authenticate extends Middleware
{
    /**
     * Redirect users if they are not authenticated.
     */
    protected function redirectTo($request)
    {
        // An API route must never answer with a redirect: clients that omit an
        // `Accept: application/json` header were being sent a 302 to the admin
        // login page instead of a 401 they could act on.
        if ($request->is('api/*') || $request->expectsJson()) {
            return null;
        }

        // ✅ Redirect browser traffic to the Filament admin login.
        return route('filament.admin.auth.login');
    }

    protected function unauthenticated($request, array $guards)
    {
        throw new AuthenticationException(
            'Unauthenticated.', $guards, $this->redirectTo($request)
        );
    }
}
