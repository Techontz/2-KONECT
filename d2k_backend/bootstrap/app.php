<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // `auth:sanctum` resolves the framework's Authenticate middleware
        // unless the alias is overridden here, so the app's own version — the
        // one that answers API routes with 401 JSON rather than a redirect to
        // the admin login — was never actually being used.
        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            // Signed-in-if-you-are, public-if-you-are-not. Used by endpoints
            // a visitor may call but which mean more when we know who called.
            'optional.auth' => \App\Http\Middleware\OptionalAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Anything under /api is a machine client. Answer it with JSON and a
        // real status code — never an HTML redirect to the admin login, which
        // is what an unauthenticated API call used to receive.
        $exceptions->shouldRenderJsonWhen(
            fn ($request, $throwable) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
