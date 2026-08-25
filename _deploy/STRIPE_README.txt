================================================================
2KONECT — Stripe TEST MODE deployment package
================================================================

20 files. Backend only. Stripe only.

  stripe-api.2konect.shop.zip
      Extracts IN PLACE into /domains/api.2konect.shop.
      No parent folder; paths are project-root relative, so every
      file merges into its exact destination.

  STRIPE_DEPLOYMENT_STEPS.txt   the ordered procedure
  STRIPE_PRODUCTION_ENV.txt     the .env block to append

The three .txt files are NOT inside the ZIP, deliberately: they
have no destination in a Laravel project root and would only
litter it.

The code in files/ is byte-identical to the tested tree: 332
backend tests, 1,277 assertions, 0 failures. Nothing was
rewritten to make this package.

----------------------------------------------------------------
WHAT IS DELIBERATELY NOT HERE
----------------------------------------------------------------

Three earlier approved pieces of work are NOT in this package,
because you asked for Stripe only. They are real fixes and your
production server does not have them:

  1. Vendor order authorisation.
     POST /api/vendor/orders/{id}/approve|complete|cancel|refund
     currently have NO ownership or role check on your server.
     Any signed-in customer can complete any order by its id, and
     completing one CREDITS A VENDOR WALLET. An order id is a
     small integer.

  2. AzamPay callback hardening, and the cross-account order
     settlement fix.

  3. Cancellation stock restoration, including the variant case
     that currently loses real stock and invents phantom stock.

None of these are needed for Stripe to work, and none of them is
made worse by this package. But (1) in particular is live and
exploitable today. It deserves its own deployment soon.

----------------------------------------------------------------
ONE SIDE EFFECT YOU MUST KNOW ABOUT
----------------------------------------------------------------

routes/api.php is a single file. The tested version contains the
Stripe routes AND the AzamPay gating from the earlier security
work. There is no way to ship the Stripe routes without also
shipping that gating, short of editing tested code — which is
exactly what you asked me not to do.

Consequence: after this deploys, these four legacy routes stop
being registered and will answer 404:

    POST /api/v1/Checkout/Callback
    POST /api/checkout
    POST /api/checkout/confirm-manual
    POST /api/checkout/vendors

This was verified across the whole repository and its git
history: no client has ever called them. Not the website, not
the current Flutter app, not the retired one. The website checks
out through POST /api/shop/orders. So the practical impact is
nil — but you should know it rather than discover it.

Do NOT try to re-enable them by setting AZAMPAY_ENABLED=true.
This package does not ship the AzamPay middleware, and that
route would then reference a middleware alias your server does
not have. If you need those routes back, deploy the security
package instead.

Nothing else about AzamPay changes. config/azampay.php is not
included and is not touched. Your AzamPay credentials are
untouched.

----------------------------------------------------------------
KNOWN BLOCKER — WEB CARD PAYMENTS WILL FAIL UNTIL THIS IS FIXED
----------------------------------------------------------------

config/cors.php on your server lists only:

    2konect.com, www.2konect.com,
    direct2kariakoo.com, www.direct2kariakoo.com

Your storefront is served from www.2konect.shop. Creating a
Checkout Session is a cross-origin request from that origin to
api.2konect.shop, so the browser will block it before it reaches
Laravel. Card payment will fail on the WEBSITE and work in the
Flutter app, which has no CORS.

config/cors.php is NOT in this package, because fixing it is a
change to a shared file that affects every API call on the site
and deserves its own review. Add your live origins to
allowed_origins before testing card payment in a browser.

----------------------------------------------------------------
STILL TRUE AFTER THIS DEPLOYS
----------------------------------------------------------------

  - Stripe is TEST MODE. STRIPE_ALLOW_LIVE=false means a live
    key is refused outright.
  - Cash on delivery is still refused for imported orders.
  - Manual Lipa Namba payment is unchanged and still requires an
    administrator to verify it.
  - Only a signature-verified webhook can settle a card order.
    Return URLs settle nothing.
  - Settlement does not move stock, does not credit a wallet,
    and does not advance the order journey.
  - Refunds and disputes are recorded only. Nothing is refunded
    automatically.

----------------------------------------------------------------
ONE THING TO FIX BEFORE ADDING A SECOND CURRENCY
----------------------------------------------------------------

App\Support\Money::toMinorUnits() is wrong for UGX. It throws on
small amounts and under-reports large ones by 100x, because UGX
appears both in Stripe's zero-decimal dataset and in their
special-cases table, which disagree. TZS is unaffected and this
does not block anything here — but it is a 100x error sitting
inside the one helper written to prevent 100x errors.
