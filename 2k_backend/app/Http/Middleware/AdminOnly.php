<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class AdminOnly
{
    public function handle($request, Closure $next)
    {
        // Allow guests to reach the login page.
        if ($request->is('admin/login') || $request->is('admin/login/*')) {
            return $next($request);
        }

        if (! Auth::check()) {
            return redirect()->route('filament.admin.auth.login');
        }

        if (Auth::user()->role !== 'admin') {
            // Refusals are worth a record. Successful admin page views are not:
            // logging an identifiable account on every request wrote the whole
            // admin's browsing history — and their email — into the log file.
            Log::warning('Non-admin account was refused the admin panel.', [
                'user_id' => Auth::id(),
                'role' => Auth::user()->role,
                'path' => $request->path(),
            ]);

            abort(403, 'Unauthorized');
        }

        return $next($request);
    }
}
