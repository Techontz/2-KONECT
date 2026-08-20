# 2KONECT

**Connect to what you need.**

A marketplace for Tanzania with two ways to buy: products already in the
country, delivered in days, and products sourced from abroad — cheaper, and
tracked the whole way in.

```
2KONECT MARKET/
├── direct2kariakoo-web/   Next.js 15 storefront and seller console
├── d2k_backend/           Laravel 12 API and Filament admin panel
├── d2k_mobile/            Flutter app (unchanged — reads the same API)
└── DOCS/                  Brand artwork and reference recordings
```

> The `direct2kariakoo-web` and `d2k_backend` directory names are pre-rename
> and are kept as they are on purpose: the backend's `.env` and its
> `public/storage` symlink hold absolute paths into them, and the Flutter app
> and deployment scripts were built against them. Nothing a shopper can see
> carries the old name.

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
cd d2k_backend
composer install
cp .env.example .env && php artisan key:generate   # first run only
php artisan migrate
php artisan serve --port=8000
```

`FILESYSTEM_PUBLIC_ROOT` in `.env` must point at this project's
`storage/app/public`, and `public/storage` must be a symlink to the same
place, or product photography 404s.

### Storefront

```bash
cd direct2kariakoo-web
npm install
npm run dev
```

`NEXT_PUBLIC_API_URL` in `.env.local` points at the API. Use the machine's LAN
address rather than `127.0.0.1` if you want to open the site from a phone.

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
cd d2k_backend        && php artisan test     # 129 tests
cd direct2kariakoo-web && npm run typecheck   # tsc --noEmit
cd direct2kariakoo-web && npm run lint
cd direct2kariakoo-web && npm run build
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

## Not done here

- The Flutter app still carries the previous brand. It reads the same API and
  is unaffected by everything above, but its interface is a separate piece of
  work.
- Payment is cash on delivery only. Lipa Namba and mobile money are shown as
  coming soon rather than faked.
- Kiswahili, French and Chinese carry the interface and the written pages, but
  the copy written for the new surfaces is English-first and falls back to
  English until a translator revises it.
