<?php
return [
    // Sandbox hosts (prod will use different)
    'auth_base_url' => env('AZAMPAY_AUTH_BASE_URL', 'https://authenticator-sandbox.azampay.co.tz'),
    'api_base_url'  => env('AZAMPAY_API_BASE_URL',  'https://sandbox.azampay.co.tz'),

    'app_name'      => env('AZAMPAY_APP_NAME'),
    'client_id'     => env('AZAMPAY_CLIENT_ID'),
    'client_secret' => env('AZAMPAY_CLIENT_SECRET'),
    'x_api_key'     => env('AZAMPAY_X_API_KEY'),

    // Paths
    'auth_path' => '/AppRegistration/GenerateToken',
    'mno_checkout'  => '/azampay/mno/checkout',

    // Subscription plans (TZS)
    'plans' => [
        'basic'      => ['amount' => 5000],
        'pro'        => ['amount' => 10000],
        'enterprise' => ['amount' => 20000],
    ],
    'duration_days' => 30,
];
