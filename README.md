# 2KONECT

**Connect to what you need.**

A marketplace for Tanzania with two ways to buy: products already in the
country, delivered in days, and products sourced from abroad — cheaper, and
tracked the whole way in.

```
2KONECT MARKET/
├── 2k-web/         Next.js 15 storefront and seller console
├── 2k_backend/     Laravel 12 API and Filament admin panel
├── d2k_mobile/     Flutter app (unchanged — reads the same API)
└── DOCS/           Brand artwork and reference recordings
```

> Two absolute paths point into `2k_backend` and have to move with it if it is
> ever renamed again: `FILESYSTEM_PUBLIC_ROOT` in `.env`, and the
> `public/storage` symlink. Get either wrong and every product photograph
> 404s while the rest of the site looks perfectly healthy.
>
> `d2k_mobile` keeps its name: the Flutter app is a separate piece of work and
> its build configuration was written against that path.

---

## What is different about this marketplace

Every product answers one question before anything else: **where is it?**

| | 🇹🇿 Available in Tanzania | 🌍 Order from abroad |
|---|---|---|
| Stock | Held by a seller here | Sourced when you order |
| Price | Local rate | Lower |
| Arrives | 1–3 days | 7–14 days by air, 30–45 by sea |
| Handled by | The seller | 2KONECT |

A product can carry **both** — the same phone, in stock in Dar for more or
shipped from Shenzhen for less — and the product page compares them side by
side with the trade-off written on each option.

Around that sit three services: **sourcing requests** for what the catalogue
does not carry, **order tracking** that records every stop on the journey, and
**2KONECT Rides** for the last mile once an imported order lands.

---

## Running it

Both halves run independently. The storefront needs the API; the API needs
MySQL.

### API

```bash
cd 2k_backend
composer install
cp .env.example .env && php artisan key:generate   # first run only
php artisan migrate
php artisan serve --port=8001
```

Port 8001, not 8000: on this machine 8000 belongs to another project. Serve on
`--host=0.0.0.0` as well if you want to open the storefront from a phone.

`FILESYSTEM_PUBLIC_ROOT` in `.env` must point at this project's
`storage/app/public`, and `public/storage` must be a symlink to the same
place, or product photography 404s.

### Storefront

```bash
cd 2k-web
npm install
npm run dev
```

`NEXT_PUBLIC_API_URL` in `.env.local` points at the API and is already set to
`http://127.0.0.1:8001/api`. No build-time override is needed. `lib/api.ts`
rewrites a loopback host to whatever host the page was opened from, so the same
value works from the laptop and from a phone on the same Wi-Fi.

### Admin

`/admin` on the API host. Sourcing requests, seller applications, deliveries,
the catalogue and order tracking are all managed there.

---

## Demo data

Two seeders exist so a fresh install can actually show the import experience.
Both are opt-in and neither runs on migrate.

```bash
# Marks a deterministic slice of the catalogue as imported and attaches
# imported alternatives to another slice. Development only.
php artisan db:seed --class=ImportSourcingDemoSeeder
php artisan db:seed --class=ImportSourcingDemoSeeder -- --revert

# Regenerates the homepage campaign artwork under the 2KONECT brand and
# archives anything still carrying the previous one.
php artisan db:seed --class=BrandBannerSeeder

# Renames the platform's own seller accounts. Never touches a real business
# and never touches an email address.
php artisan db:seed --class=BrandRenameSeeder
```

---

## Checks

```bash
cd 2k_backend && php artisan test     # 132 tests
cd 2k-web     && npm run typecheck   # tsc --noEmit
cd 2k-web     && npm run lint
cd 2k-web     && npm run build
```

---

## Where things live

**Backend**

| Concern | File |
|---|---|
| Where a product is, and when it lands | `app/Support/Sourcing.php` |
| Order statuses and the tracking timeline | `app/Support/OrderJourney.php` |
| Storefront catalogue, filters and facets | `app/Http/Controllers/Api/Shop/CatalogController.php` |
| Checkout, order history, cancellation | `app/Http/Controllers/Api/Shop/OrderController.php` |
| Sourcing requests | `app/Http/Controllers/Api/Shop/ProductRequestController.php` |
| Seller applications | `app/Http/Controllers/Api/Shop/VendorApplicationController.php` |
| 2KONECT Rides | `app/Http/Controllers/Api/Shop/DeliveryRequestController.php` |
| Seller earnings and payouts | `app/Http/Controllers/Api/WalletController.php`, `WithdrawalController.php` |

**Frontend**

| Concern | File |
|---|---|
| Design tokens | `app/globals.css` |
| Brand name, logo paths, support details | `lib/brand.ts` |
| Availability badges and panels | `components/sourcing/Availability.tsx` |
| Local-versus-imported comparison | `components/sourcing/BuyingOptions.tsx` |
| Order tracking timeline | `components/sourcing/JourneyTimeline.tsx` |
| The one product card | `components/product/ProductCard.tsx` |
| The one listing surface | `components/product/ListingView.tsx` |
| The one inbox, both sides | `components/chat/Inbox.tsx` |
| Per-route titles and descriptions | `lib/pageMeta.ts` + each route's `layout.tsx` |

---

## Architecture notes

Everything added is **additive**. The Flutter app and the existing seller
console read the same endpoints they always did, and every new database column
is nullable or defaulted, so the catalogue, the seller portal and the live
orders kept working through the transformation.

- **Sourcing lives on the product row.** `availability`, `source_country`,
  `shipping_method` and a lead-time window. A client that has never heard of
  any of them gets the local default.
- **A product can carry more than one offer.** `product_offers` holds
  alternatives; the product's own row is always the primary. A product with no
  rows there behaves exactly as before.
- **The promise is stored on the order.** Editing a listing afterwards cannot
  rewrite what a buyer was told at checkout.
- **Tracking reads recorded events.** `order_events` is the audit trail; a step
  is only ever shown as done because the order actually passed it.
- **Approval creates sellers, not registration.** An application lands in the
  admin queue; approving it is what creates the vendor record.

## Before this goes live

Three things cannot be done from this repository. Each needs somebody signed in
to a provider's console, and none of them is configured by the code below.

**1. Authorise the production domain for Firebase.** In the Firebase console for
project `konect-83a21` → Authentication → Settings → Authorized domains, add
`2konect.com` (and any other origin the storefront is served from). Until that
is done, Google sign-in in production fails with `auth/unauthorized-domain`.
The button reports it as a configuration problem rather than as user error, but
nobody can sign in with Google.

**2. Enable the Google provider on `konect-83a21`.** Authentication →
Sign-in method → Google → Enable, with a support email set. Verified locally
against the project's own auth handler; the provider switch itself is console
state, not code.

**3. Decide about analytics consent.** Firebase Analytics is wired up and
**fires a `page_view` to `G-GDLZW1PNYG` on every page load, with no consent gate
in front of it**. That is deliberate and it is a launch decision, not an
oversight: for visitors in Tanzania it is the ordinary arrangement, but the same
build served to anyone in the EEA/UK needs consent before those events are sent.
Two ways to settle it, in rising order of effort:

- Leave `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` unset in production. Nothing is
  loaded, nothing is sent, and no other behaviour changes — `lib/firebase.ts`
  checks for it before importing the module at all.
- Keep it, and put a consent banner in front of `startAnalytics()`
  (`components/analytics/FirebaseAnalytics.tsx` is the single call site).

## Not done here

- The Flutter app still carries the previous brand. It reads the same API and
  is unaffected by everything above, but its interface is a separate piece of
  work.
- Payment is cash on delivery only. Lipa Namba and mobile money are shown as
  coming soon rather than faked.
- Seller subscriptions have a working backend (`SubscriptionController`, AzamPay,
  plans in `config/azampay.php`) but no screen. The previous one posted to a URL
  that did not exist and advertised benefits — listing limits, API access — that
  nothing enforces, so it was removed rather than left to mislead. Define what
  the tiers actually do, then build it.
- Kiswahili, French and Chinese carry the interface and the written pages, but
  the copy written for the new surfaces is English-first and falls back to
  English until a translator revises it.
- Product pages are client-rendered, so a crawler that does not run JavaScript
  sees the generic listing title rather than the product's name. The JSON-LD
  block carries the real price, currency and availability either way.
