================================================================
Stripe saved-card support — PENDING, not deployed, not committed
================================================================

WHY THIS EXISTS

Two files were reverted to their production-exact versions so that
the Git repository could be made to match the running server. The
saved-card work that was in them lives here, and nowhere else.

It was NOT already preserved anywhere before this. The deployment
ZIP (_deploy/stripe-api.2konect.shop.zip) contains the PRODUCTION
versions of these files, which is the opposite of what is here.

WHAT IT DOES

  CheckoutSessionBuilder.php  (+48 lines)
      Passes an existing Stripe Customer when the shopper has one,
      so Stripe offers their saved card instead of an empty form;
      otherwise asks Stripe to create one. Adds
      setup_future_usage: 'on_session', which is what actually
      saves the card.

  WebhookProcessor.php  (+28 lines)
      rememberCustomer(): writes session.customer onto
      users.stripe_customer_id, and never overwrites an existing
      one — a shopper's cards are attached to one customer.

No card number, expiry or CVC touches 2KONECT in either file.
Only an opaque customer id is stored. The users.stripe_customer_id
column already exists on production; it is simply never populated
until this ships.

HOW TO BRING IT BACK

  cd "/path/to/2KONECT MARKET"
  git apply _deploy/stripe-saved-cards-pending/saved-cards.patch

or copy source/app/Services/Stripe/*.php over 2k_backend/.

Tests for this behaviour already exist and pass:
  StripeCheckoutSessionTest
    - a first time shopper has a stripe customer created for them
    - a returning shopper is sent as their existing customer
    - the card is saved for next time
    - no card detail is ever sent to or stored by 2konect
  StripeWebhookTest
    - the stripe customer is remembered for next time
    - an existing customer id is not overwritten

BEFORE SHIPPING IT

Deploying these two files changes live payment behaviour, so it
wants its own release and its own test pass against Stripe test
mode — not a quiet ride along with something else.
