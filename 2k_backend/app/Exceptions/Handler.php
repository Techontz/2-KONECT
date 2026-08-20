<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;
use Illuminate\Auth\AuthenticationException;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        //
    ];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        // LOGGING TO DEBUG IF THIS METHOD IS BEING CALLED
        \Log::info('=== CUSTOM UNAUTHENTICATED HANDLER CALLED ===', [
            'expectsJson' => $request->expectsJson(),
            'is_api' => $request->is('api/*'),
        ]);

        return response()->json(['message' => 'Unauthenticated.'], 401);
    }
}
