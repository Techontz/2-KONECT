================================================================
2KONECT web — Stripe card checkout fix
================================================================

READ THIS FIRST: THERE IS NOTHING HERE TO UPLOAD TO A SERVER.

www.2konect.shop is hosted on Vercel. Verified from the live
response headers:

    server: Vercel
    x-nextjs-prerender: 1
    x-nextjs-stale-time: 300

and confirmed by probing for raw static files:

    /checkout/index.html  -> 404
    /index.html           -> 404
    /404.html             -> 404

So the site is NOT a folder of files on a server you can replace.
It is a Next.js application that Vercel builds and runs. Uploading
a build directory to it is not a thing that exists.

The `out/` folder in the repo is a leftover static export from
30 December 2025. It is eight months stale and is not what is
serving the site. Ignore it.

----------------------------------------------------------------
HOW THIS ACTUALLY DEPLOYS
----------------------------------------------------------------

    git commit  ->  git push origin main  ->  Vercel builds  ->  live

Evidence: the repo tracks https://github.com/Techontz/2-KONECT.git,
local `main` equals `origin/main` at cc5de24 ("Add Stripe test-mode
checkout"), and the live bundle contains exactly the strings from
that commit and none from the newer working-tree fix.

You told me not to commit and not to push. Those are the only two
ways to deploy this. So this package contains the change in
portable form and stops there — the deploy itself is one command
you run when you are ready.

----------------------------------------------------------------
WHAT IS IN HERE
----------------------------------------------------------------

  stripe-checkout-fix.patch
      The complete change as a git patch, 423 lines, 7 files.
      Apply with:
          cd /path/to/2-KONECT
          git apply _deploy/.../stripe-checkout-fix.patch

  source/2k-web/...
      The same 8 files whole, if you would rather copy them over
      than apply a patch. Byte-identical to the tested tree.

  (no build output — see above)

----------------------------------------------------------------
TO DEPLOY, WHEN YOU APPROVE
----------------------------------------------------------------

    cd "/Users/conradbuberwa/Desktop/MOBILE APPS/2KONECT MARKET"
    git add 2k-web
    git commit -m "Take card checkout to Stripe from the checkout page"
    git push origin main

Vercel builds automatically. Watch it at vercel.com; a build takes
a couple of minutes. No server restart, no cache to clear, no
files to move.

There is a second route if you prefer not to push yet:

    npm i -g vercel
    cd 2k-web && vercel --prod

That uploads the source and builds it on Vercel without touching
GitHub. It will ask you to link the project the first time.

----------------------------------------------------------------
VERIFYING IT WORKED
----------------------------------------------------------------

After the deploy, the live checkout bundle should contain the
strings it currently does not:

    curl -s https://www.2konect.shop/checkout/ \
      | grep -oE '/_next/static/chunks/app/checkout/[^"]+\.js' \
      | head -1

then fetch that chunk and grep it for `checkout-session` and
`stripe=unavailable`. Both are absent today and must be present
afterwards.

Then the real test: add something to the basket, choose Card
payment, and confirm the button reads "Pay & place order" and
takes you to checkout.stripe.com.

----------------------------------------------------------------
STATE OF THE REST
----------------------------------------------------------------

Backend      already deployed and correct. Verified live:
             the `stripe` channel is ACTIVE with is_gateway true.

CORS         already fixed on the server. The API returns
             access-control-allow-origin: https://www.2konect.shop
             I had this listed as a blocker; it is not one.

Saved cards  NOT deployed. Two backend files
             (CheckoutSessionBuilder.php, WebhookProcessor.php)
             are still pending. Card payment works without them;
             saved cards do not.
