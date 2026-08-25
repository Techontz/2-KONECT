2KONECT - HOTFIX
Filament 500 on /admin/vendor-applications
======================================================================

ROOT CAUSE (proven by reproducing it, not inferred)

  Illuminate\Contracts\Container\BindingResolutionException:
  "An attempt was made to evaluate a closure for
   [Filament\Tables\Columns\TextColumn], but [$s] was unresolvable."
  at vendor/filament/support/src/Concerns/EvaluatesClosures.php:98

  Filament injects closure arguments BY PARAMETER NAME (or by a
  resolvable type). It knows $state, $record, $column, $livewire...
  It does not know $s, and `string` is not a type it can resolve.

  Three resources declared badge/format callbacks as `fn (string $s)`.
  The closure is only evaluated when a ROW IS RENDERED, so an empty
  table loads fine and the page 500s the moment the first record
  exists. That is why it "suddenly" broke.

  NOT caused by the international prepayment deployment. The file is
  untouched by that release and the faulty line is in commit 33de111,
  long before it. What changed was the data, not the code.

THE FIX

  Rename the closure parameter to the name Filament injects. Nothing
  else changed - no logic, no columns, no actions, no queries.

    - ->color(fn (string $s) => match ($s) { ... })
    + ->color(fn (string $state) => match ($state) { ... })

  7 closures across 3 files:
    VendorApplicationResource.php   1   (the reported 500)
    ProductRequestResource.php      2   (same latent bug)
    DeliveryRequestResource.php     4   (same latent bug)

  The other two were found by sweeping every Filament resource for the
  same pattern. They would have 500'd the same way as soon as a product
  request or delivery request existed - and delivery requests are
  created by the new international flow, so that one was about to fire.

  Plain Laravel closures such as
      collect(...)->mapWithKeys(fn ($s) => ...)
  are NOT affected and were deliberately left alone.

DEPLOY

  APP=/home/konectsh/domains/api.2konect.shop
  cd "$APP"

  # 1. back up
  STAMP=$(date +%Y%m%d-%H%M%S)
  BK="$APP/backup-filament-closure-$STAMP"
  mkdir -p "$BK/app/Filament/Resources"
  cp -p app/Filament/Resources/VendorApplicationResource.php "$BK/app/Filament/Resources/"
  cp -p app/Filament/Resources/ProductRequestResource.php    "$BK/app/Filament/Resources/"
  cp -p app/Filament/Resources/DeliveryRequestResource.php   "$BK/app/Filament/Resources/"

  # 2. upload files/ over the app root (3 files only)

  # 3. syntax check
  php -l app/Filament/Resources/VendorApplicationResource.php
  php -l app/Filament/Resources/ProductRequestResource.php
  php -l app/Filament/Resources/DeliveryRequestResource.php

  # 4. clear caches (view cache holds compiled Blade for these tables)
  php artisan optimize:clear
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  php artisan event:cache

  No migration. No seeder. No database change of any kind.

VERIFY

  Log in to the admin panel and open each of these - all must load and
  show their rows:

    /admin/vendor-applications
    /admin/product-requests
    /admin/delivery-requests
    /admin/orders
    /admin/checkout-payment-channels
    /admin

  Then confirm the log is quiet:

    tail -n 50 storage/logs/laravel.log

  And that nothing else regressed:

    curl -s -o /dev/null -w "sitemap: %{http_code}\n" https://api.2konect.shop/api/shop/sitemap
    curl -s -o /dev/null -w "channels: %{http_code}\n" https://api.2konect.shop/api/shop/payment-channels

ROLLBACK

  cp -p "$BK/app/Filament/Resources/"*.php app/Filament/Resources/
  php artisan optimize:clear && php artisan view:cache
