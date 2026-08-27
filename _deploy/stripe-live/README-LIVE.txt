================================================================
2KONECT — Stripe LIVE readiness package
================================================================

WHAT THIS IS
  9 PHP files, laid out relative to the Laravel project root.
  Extract directly into /domains/api.2konect.shop/ and let it
  overwrite. No parent folder, no vendor/, no .env.

  Nothing here changes the database. No migration is required by
  this package.

WHAT CHANGED, AND WHY IT MATTERS TODAY
  1. app/Console/Commands/StripeDoctor.php          (NEW)
     `php artisan stripe:doctor` — reports what THIS server has
     actually loaded. It prints no keys, ever; where identity
     matters it prints an 8-character SHA-256 fingerprint so two
     environments can be compared without either being revealed.

  2. app/Http/Controllers/Api/Shop/StripeCheckoutController.php
     A live key on a build without STRIPE_ALLOW_LIVE made the
     factory throw a RuntimeException that escaped this method
     uncaught. Shoppers met a 500 and the reason existed only in
     a stack trace. Now a 503 and a log line that names it.

  3. app/Services/Stripe/CheckoutSessionBuilder.php
     Refuses a zero or negative total before contacting Stripe,
     and honours an optional STRIPE_MINIMUM_MINOR floor.

  4. app/Exceptions/UnchargeableOrder.php           (NEW)
     The type those refusals carry. Deliberately NOT the SPL
     InvalidArgumentException: Stripe's own library extends that
     class, so catching it broadly would report a library error
     to a shopper as a problem with their order.

  5. config/stripe.php
     Adds STRIPE_MINIMUM_MINOR, defaulting to 0 (off).

  6-9. WebhookProcessor, StripeClientFactory, StripeWebhookController,
     Money — included unchanged-or-current so the server is known
     to be running the same code as the repository. If the saved-
     card work was never deployed, these carry it.

AFTER EXTRACTING — RUN THESE, IN ORDER
    cd /domains/api.2konect.shop
    php artisan config:clear
    php artisan config:cache
    php artisan route:clear
    php artisan stripe:doctor

  Read the output. It ends in either
      "No problems found..."   or   "N problem(s) found."

  Then, to confirm Stripe itself accepts the key and the account
  can take money today:

    php artisan stripe:doctor --ping

  --ping makes ONE read-only call to /v1/account. It creates
  nothing, charges nothing and costs nothing.

  The output is safe to paste into a chat window. That is what it
  was built for.

WHAT THE DOCTOR CANNOT TELL YOU
  Whether STRIPE_WEBHOOK_SECRET is the secret belonging to the
  ACTIVE live destination. It can only confirm the shape is right
  and print a fingerprint. The authoritative check is the Stripe
  Dashboard: Developers -> Webhooks -> your live destination ->
  recent deliveries. A wrong secret shows there as a run of 400s.
