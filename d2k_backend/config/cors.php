<?php

return [

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
    ],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'https://direct2kariakoo.com',
        'https://www.direct2kariakoo.com',
    ],

    // Development only. The storefront is opened both from this machine and
    // from phones on the same Wi-Fi, so the origin is whatever private address
    // the laptop happens to have that day — pinning a single one breaks the
    // next time DHCP hands out a different lease. Public deployments never
    // match these patterns, so nothing here widens production.
    'allowed_origins_patterns' => env('APP_ENV') === 'production' ? [] : [
        '#^http://localhost(:\d+)?$#',
        '#^http://127\.0\.0\.1(:\d+)?$#',
        '#^http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^http://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
