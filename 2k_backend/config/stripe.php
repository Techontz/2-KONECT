<?php

use App\Support\Money;

return [

    /*
    |--------------------------------------------------------------------------
    | Is the Stripe channel switched on?
    |--------------------------------------------------------------------------
    |
    | Off by default, and separately from the `checkout_payment_channels` row,
    | which also ships inactive. Two switches rather than one: this decides
    | whether the routes exist at all, the row decides whether a shopper is
    | offered it. Turning Stripe on is therefore a deliberate act in two
    | places, neither of which happens by deploying code.
    */
    'enabled' => (bool) env('STRIPE_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Credentials
    |--------------------------------------------------------------------------
    |
    | Never committed, never in the frontend bundle, never in the mobile app.
    | Prefer a restricted key (`rk_test_…`) over a secret key (`sk_test_…`):
    | this integration needs only Checkout Sessions write, PaymentIntents read
    | and Events read, and a restricted key that leaks can do nothing else.
    |
    | `webhook_secret` is a separate credential from the API key and is
    | different for test and live. Signature verification is the only thing
    | standing between the webhook endpoint and anybody who can POST JSON, so
    | it is treated with the same care as the key itself.
    */
    'secret'          => env('STRIPE_SECRET'),
    'publishable_key' => env('STRIPE_PUBLISHABLE_KEY'),
    'webhook_secret'  => env('STRIPE_WEBHOOK_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Live-mode guard
    |--------------------------------------------------------------------------
    |
    | This integration is built and approved for test mode. A live key is
    | refused unless somebody deliberately sets this, so a copied env file or a
    | mistyped secret cannot start taking real money from a build that has
    | never been exercised against one.
    */
    'allow_live' => (bool) env('STRIPE_ALLOW_LIVE', false),

    /*
    |--------------------------------------------------------------------------
    | API version
    |--------------------------------------------------------------------------
    |
    | Pinned explicitly rather than following the account default, so that a
    | version rolled forward in the Dashboard cannot change the shape of a
    | webhook this code parses.
    */
    'api_version' => env('STRIPE_API_VERSION', '2026-07-29.dahlia'),

    /*
    |--------------------------------------------------------------------------
    | Presentment currency
    |--------------------------------------------------------------------------
    |
    | TZS, matching the currency the catalogue is priced in, so a shopper is
    | charged the number they were shown with no conversion in between.
    |
    | Verified rather than assumed, against Stripe's own published dataset:
    |
    |   • TZS IS a supported presentment currency in all 45 published Stripe
    |     account countries.
    |   • TZS is NOT zero-decimal. It is absent from Stripe's zero-decimal
    |     list, so TZS 50,000 is submitted as 5000000. Money::toMinorUnits()
    |     is the single place that conversion happens.
    |
    | Two things this does not settle, both outside the code:
    |
    |   1. Tanzania is not a Stripe account country, so whichever entity holds
    |      the account will be somewhere else and will settle in its own
    |      currency. Stripe converts; the shopper still pays TZS.
    |   2. Minimum charge amounts are enforced against the *settlement*
    |      currency, not the presentment one. A ~0.50 USD floor is roughly
    |      1,300 TZS, so a very cheap order can be refused by Stripe even
    |      though its TZS figure looks fine.
    */
    'currency' => env('STRIPE_CURRENCY', Money::BASE),

    /*
    |--------------------------------------------------------------------------
    | Where Stripe sends the shopper back to
    |--------------------------------------------------------------------------
    |
    | Both land on the order page. Neither settles anything: the query string
    | is informational, the page refetches the order, and only the webhook can
    | have moved it. A shopper who never returns is still paid up, and a
    | shopper who forges `?stripe=success` has achieved nothing.
    */
    'return_base_url' => rtrim((string) env('STRIPE_RETURN_BASE_URL', 'https://www.2konect.shop'), '/'),

    /*
    |--------------------------------------------------------------------------
    | Checkout Session lifetime
    |--------------------------------------------------------------------------
    |
    | Stripe's minimum is 30 minutes. When it lapses the session expires, the
    | webhook tells us, and the order goes back to awaiting payment so the
    | shopper can try again.
    */
    'session_ttl_minutes' => (int) env('STRIPE_SESSION_TTL_MINUTES', 60),

];
