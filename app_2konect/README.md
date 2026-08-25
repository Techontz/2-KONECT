# 2KONECT — mobile app

The mobile equivalent of the 2KONECT storefront at **https://www.2konect.shop**,
running on the **same production backend, the same account, the same cart, the
same orders and the same business rules**.

Nothing here is a parallel system. The API is `/api/shop/*` on
`https://api.2konect.shop`, the design tokens are ported from
`2k-web/app/globals.css`, the wording is generated from
`2k-web/lib/i18n/dictionaries/*`, and every checkout rule is decided by
`App\Support\CheckoutPolicy` on the server.

---

## Running it

```bash
flutter pub get

# Production (the default — a release build can never point at a laptop)
flutter run --release

# Against a local backend
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8001/api
```

`10.0.2.2` is the host machine as seen from the Android emulator. A physical
handset needs the laptop's LAN address and `php artisan serve --host=0.0.0.0`.

```bash
flutter analyze
flutter test
flutter build apk --release
flutter build apk --release --split-per-abi   # per-ABI APKs, much smaller than the 61 MB fat one
```

---

## Google sign-in — what is done, and what only you can do

The app reproduces the website's architecture exactly:

```
Google  →  Firebase Authentication  →  Firebase ID token
                                            ↓
                                POST /api/auth/google
                                            ↓
                                    Laravel + Sanctum
```

No Socialite, no second OAuth implementation, no second session system. The
button owns only the first hop; the moment an ID token exists it goes to the
same endpoint the browser posts to.

**Status**

| | |
|---|---|
| Flutter code | **done** — button, Firebase call, token exchange, error handling, all four languages |
| Android Gradle | **done** — the Google Services plugin is wired to apply itself the moment `android/app/google-services.json` appears |
| Firebase Android app | **missing** — must be created in the console |
| Firebase iOS app | **missing** — must be created in the console |
| Real Google round-trip | **not performed** — impossible without the two above |

The button is deliberately **always visible**. Hiding it makes an unfinished
deployment look like a product decision. Pressed on an unconfigured build it
answers plainly — *"Google sign-in is not available on this site yet"* — rather
than failing silently.

### What is missing, exactly

The Firebase project is **`konect-83a21`** (confirmed live: its authorised
domains are `localhost`, `konect-83a21.firebaseapp.com`,
`konect-83a21.web.app`, `2konect.shop`, `www.2konect.shop`). It has a **web**
app registered — that is what the website uses — and no mobile apps.

A mobile app registration cannot be created from this repository: it is a
console action, and it produces an OAuth client bound to the app's package name
and signing certificate. Nothing here can stand in for it.

### Android — five minutes in the console

1. Firebase console → project **konect-83a21** → **Add app → Android**.
2. Package name — exactly:
   ```
   shop.konect.app
   ```
3. Add the signing certificate fingerprints. The project currently signs
   release with the debug key (`android/app/build.gradle.kts` says so), so this
   machine's debug certificate covers both:
   ```
   SHA-1    A3:98:E1:08:28:6E:CE:C3:1E:B6:FA:D6:3C:3B:FA:76:11:12:AD:74
   SHA-256  D2:1B:11:10:35:E2:4C:AB:18:9F:1E:B0:86:E3:7B:6D:FB:78:85:9A:91:AA:18:04:ED:4C:E6:03:C8:B5:A3:2D
   ```
   Regenerate them any time with:
   ```bash
   keytool -list -v -alias androiddebugkey \
     -keystore ~/.android/debug.keystore -storepass android -keypass android
   ```
   When you create a real release keystore, add **its** SHA-1 too, and add the
   Play App Signing SHA-1 from the Play Console once the app is uploaded —
   otherwise Google sign-in works in your builds and fails in Play's.
4. Download `google-services.json` → `android/app/google-services.json`.
5. Firebase console → **Authentication → Sign-in method → Google → Enable**
   (already on for web, so this is usually just a confirmation).

That is all. **No code change.** The Gradle plugin applies itself when the file
appears — the build logs `2KONECT: google-services.json found - Firebase
enabled.` — and `FirebaseIdentity.available` flips to true.

### iOS

1. **Add app → iOS**, bundle id exactly:
   ```
   shop.konect.app
   ```
2. Drop `GoogleService-Info.plist` into `ios/Runner/` **and add it to the
   Runner target in Xcode** — copying the file into the folder is not enough.
3. Add the reversed client id as a URL scheme. Take `REVERSED_CLIENT_ID` from
   that plist and add to `ios/Runner/Info.plist`:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array><string>com.googleusercontent.apps.YOUR-REVERSED-ID</string></array>
     </dict>
   </array>
   ```

Email-and-password sign-in and registration work today, with no Firebase.

## Payment configuration — the other thing that needs you

`GET /api/shop/payment-channels` currently returns **`channels: []`** on
production: no administrator has switched a channel on yet.

The app handles that honestly rather than papering over it:

| basket | what the app does |
|---|---|
| local only | offers **Cash on delivery**, exactly as before |
| contains an import, channels configured | offers Lipa Namba / Mobile Money **only** |
| contains an import, **no** channels configured | says payment is unavailable, and still offers no COD |

To turn on Lipa Namba, set it active in the Filament admin panel with its
merchant name and number. **The number is never in this repository** — it
changes without a release, an administrator owns it, and a number compiled into
an APK is a number that is wrong the day it changes.

---

## Architecture

```
lib/
  core/
    brand.dart            Brand identity, mirroring 2k-web/lib/brand.ts
    config/env.dart        API base URL; production by default
    format.dart            Money and dates; language ≠ currency
    l10n/                  Strings + the four generated dictionaries
    network/               Dio client, ApiException
    router/                go_router, incl. the protected-route redirect
    storage/               Sanctum token in Keychain / EncryptedSharedPreferences
    theme/                 tokens.dart ← 2k-web/app/globals.css
  models/                  Every /api/shop/* response, strongly typed
  services/                One class per API surface
  providers/               Riverpod: session, cart, wishlist, catalogue, language
  features/                One folder per screen area
  widgets/                 ProductCard, AvailabilityStrip, states, shell
```

## The rules this app must never break

1. **Cash on delivery is impossible for an import.** Not disabled — absent.
2. **The Lipa Namba number always comes from the server.**
3. **The customer can never mark a payment verified.** Submitting a reference
   moves the order to `awaiting_verification`, which is a queue.
4. **Delivery is separate from payment**, and no fee is invented for an import.
5. **Order status, payment status and delivery status are three axes**, never
   merged.
6. **Prices are never computed on the device** — `/shop/cart/quote` prices the
   basket with the same code that will charge for it.

`test/checkout_rules_test.dart` asserts all of these at the widget level.
