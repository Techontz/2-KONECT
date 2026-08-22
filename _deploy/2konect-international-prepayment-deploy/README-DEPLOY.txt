2KONECT - INTERNATIONAL PREPAYMENT
BACKEND DEPLOYMENT PACKAGE
======================================================================

WHAT THIS IS

  16 backend files that make products sourced from abroad prepaid:
  no cash on delivery, no automatic delivery charge, payment by Lipa
  Namba with a human verifying it, and delivery added separately
  afterwards by an administrator.

  Target: /home/konectsh/domains/api.2konect.shop


READ THESE THREE THINGS FIRST

  1. LIPA NAMBA ARRIVES SWITCHED OFF.
     The seeder creates it with no number and is_active = false. Until
     an administrator enters the real number in the admin panel,
     international checkout has no payment method and says so plainly.
     No number, real or invented, is included in this package.
     This is Step 9 of DEPLOYMENT_INSTRUCTIONS.txt.

  2. YOUR SITEMAP IS SAFE.
     routes/api.php is included and contains BOTH the payment routes and
     the sitemap route already live on your server.
     CatalogController.php - which holds the sitemap() method - is NOT in
     this package and will not be touched.

  3. DO NOT RUN THE TEST SUITE ON PRODUCTION.
     tests/ is included as proof, not as something to run there. The
     suite uses RefreshDatabase. Deleting the tests/ folder from the
     upload changes nothing at runtime.


CONTENTS

  files/                          the tree to copy over the app root
  DEPLOYMENT_MANIFEST.txt         every file, NEW/MODIFIED, why, sha256
  DEPLOYMENT_INSTRUCTIONS.txt     backup -> upload -> migrate -> verify
  README-DEPLOY.txt               this file


THE SHORT VERSION

  cd /home/konectsh/domains/api.2konect.shop
  # 1. back up          (Step 1)
  # 2. diff routes/api.php before overwriting  (Step 2)
  # 3. copy files/ over the app root
  php artisan migrate --force
  php artisan db:seed --class=CheckoutPaymentChannelSeeder --force
  php artisan optimize:clear
  php artisan config:cache && php artisan route:cache
  php artisan view:cache && php artisan event:cache
  # 4. verify, especially that /api/shop/sitemap still returns 200
  # 5. turn Lipa Namba on in the admin panel

  Nothing here deletes data. No migrate:fresh, no db:wipe, no reset.
