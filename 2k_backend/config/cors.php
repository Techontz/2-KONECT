<?php

return [

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
    ],

    'allowed_methods' => ['*'],

    // ---- the domains the storefront is actually served from ----
    //
    // `2konect.shop` is the live one and was missing from this list. It had
    // been added by hand on the production server instead, which worked right
    // up until a deployment shipped this file and replaced it — and then every
    // browser request from the storefront was blocked by CORS at once. The
    // API answered 200 to curl the whole time, because curl does not enforce
    // CORS, so it looked like the frontend had broken.
    //
    // The lesson is in the list, not the comment: a domain the site is served
    // from belongs in version control, where a deployment carries it, rather
    // than in a file edited on a server where the next deployment removes it.
    //
    // `.com` and the previous brand stay while their DNS still resolves.
    // Dropping one here breaks that site the moment this deploys, which is
    // exactly the mistake being fixed.
    'allowed_origins' => [
        'https://2konect.shop',
        'https://www.2konect.shop',
        'https://2konect.com',
        'https://www.2konect.com',
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

    // Wide on purpose. The storefront sends `X-Currency` on every request and
    // will send others; a request header is not a credential, and an explicit
    // list here is a second place to remember to update when the frontend adds
    // one. `allowed_origins` above is what actually restricts access.
    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
