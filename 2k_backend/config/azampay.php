<?php
return [
    /*
    |--------------------------------------------------------------------------
    | Is the AzamPay surface switched on at all?
    |--------------------------------------------------------------------------
    |
    | Off by default, and deliberately so. Nothing in this repository has ever
    | called the AzamPay checkout endpoints — not the website, not the current
    | Flutter app, and not the retired one (checked against its own source in
    | git history). What did exist was a callback that any stranger could post
    | to, which marked orders paid and created vendor wallet balance.
    |
    | While this is false the legacy routes are not registered, so a request to
    | them is a 404 rather than a refusal — nothing to probe and nothing to
    | fingerprint. Turning it on requires a deliberate change plus a callback
    | secret below, because a flag alone is not a security boundary.
    */
    'enabled' => (bool) env('AZAMPAY_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Callback gate
    |--------------------------------------------------------------------------
    |
    | AzamPay publishes no callback signing mechanism. Their documented callback
    | body — msisdn, amount, message, utilityref, operator, reference,
    | transactionstatus, submerchantAcc — carries no signature, no HMAC and no
    | timestamp, and their own SDK authors document none. So there is nothing
    | of theirs to verify, and this is not a claim that there is.
    |
    | What follows is therefore a gate we own, not authentication of origin: a
    | shared secret we generate and register as part of the callback URL, plus
    | an optional IP allowlist. It keeps the endpoint from being a public
    | write, and that is all it does. It is emphatically NOT sufficient to
    | settle a payment on, which is why the callback cannot settle one — see
    | App\Services\AzamPay\CallbackProcessor.
    |
    | Generate with: php -r "echo bin2hex(random_bytes(32));"
    |
    | Note the secret travels in a URL or header and will appear in web server
    | access logs at both ends. That is unavoidable without a provider-side
    | signature, and it is another reason settlement does not depend on it.
    */
    'callback_secret' => (string) env('AZAMPAY_CALLBACK_SECRET', ''),

    // Optional. Comma-separated IPs or CIDR ranges, once AzamPay confirms
    // their egress addresses. Empty means the check is not applied.
    'callback_ips' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('AZAMPAY_CALLBACK_IPS', '')),
    ))),

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
