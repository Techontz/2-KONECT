# 2KONECT — storefront

The customer-facing marketplace and the seller console. Next.js 15 (App
Router), React 19, Tailwind v4, talking to the Laravel API in `../2k_backend`.

See the [repository README](../README.md) for what 2KONECT is and how to run
both halves together.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

## Configuration

`.env.local`, copied from `.env.example`:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_API_URL` | every request (`lib/api.ts`) |
| `NEXT_PUBLIC_SITE_URL` | metadata, sitemap, `robots.txt` |
| `NEXT_PUBLIC_FIREBASE_*` | Google sign-in (`lib/firebase.ts`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | the delivery-address picker |

Every one is a public client identifier. A feature whose key is missing simply
does not render — no broken control, no error.

Use the machine's LAN address rather than `127.0.0.1` for `NEXT_PUBLIC_API_URL`
if you want to open the site from a phone: `lib/api.ts` corrects a loopback
host at runtime, but the value it starts from has to be reachable.

## How it is put together

- **One design system.** `app/globals.css` holds every colour, radius, shadow
  and layout constant as a token. Components reference tokens; nothing
  hard-codes a hex value. The ink ramp clears WCAG AA against every surface
  defined there.
- **One of each component.** One product card, one listing surface, one
  availability badge. Variants are props, never copies — that is what keeps
  the shop, the category page, search and deals from drifting apart.
- **Availability is a first-class component family.** `components/sourcing/`
  answers "where is it and when do I get it?" for the card, the product page,
  the cart, the checkout and the order.
- **Chrome is composed, not inherited.** Storefront routes render
  `<SiteChrome>` themselves, so the seller console and auth screens can opt
  out of the shop header and footer.
- **Browsable signed-out.** Cart, wishlist and language live in browser
  storage; authentication is asked for at checkout, not at the door.

## Layout

```
app/                 routes — storefront, account, seller console
components/
  brand/             the logo lockup
  sourcing/          availability, buying options, order journey, trust
  product/           card, gallery, shelf, listing, seller panel
  layout/            header, category nav, mobile menu, tab bar, footer
  ui/Primitives.tsx  buttons, fields, tags, empty and loading states
lib/
  brand.ts           name, logo paths, support details
  shop.ts            the typed API client
  types.ts           the API's shapes
  store/             cart, auth, wishlist, location
  i18n/              interface dictionary and long-form page copy
```
