import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getRedirectResult,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
} from "firebase/auth";

/**
 * Firebase Authentication for the storefront.
 *
 * Only Authentication is used, and only as an identity provider: Firebase says
 * who the shopper is, Laravel decides what that means for 2KONECT and issues the
 * Sanctum token the rest of the app already runs on. There is no second
 * session system.
 *
 * Every value here is a public client identifier. Firebase config is designed
 * to ship in a browser bundle — it identifies the project, it does not
 * authorise anything. Access is controlled by the Firebase console's authorised
 * domains and by our own server-side token verification. No service-account
 * key is ever present on the client.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** True once the deployment has been given its Firebase values. */
export const firebaseConfigured = Boolean(
  // authDomain is included deliberately: the sign-in popup is opened against
  // https://<authDomain>/__/auth/handler, so without it the button would render
  // and then fail at the moment it is used.
  config.apiKey && config.projectId && config.appId && config.authDomain,
);

let app: FirebaseApp | undefined;

function firebaseApp(): FirebaseApp | undefined {
  if (!firebaseConfigured) return undefined;
  if (app) return app;

  // Next's fast refresh can evaluate this module more than once, and every
  // caller here funnels through this one function — so initializeApp() runs
  // at most once per browser, never per component.
  app = getApps().length ? getApps()[0] : initializeApp(config as Required<typeof config>);
  return app;
}

/**
 * Starts Firebase Analytics, if this deployment has a measurement id.
 *
 * Analytics is browser-only — it reads `window`, `document` and cookies — so
 * it must never be touched while the page is being rendered on the server or
 * during hydration. Three things keep that true: the module is imported
 * dynamically (so it is not in the server bundle at all), the call is guarded
 * on `window`, and Firebase's own `isSupported()` is awaited, which is what
 * declines gracefully in a private window or a browser with storage blocked.
 *
 * It renders nothing and sets no state, so it cannot cause a hydration
 * mismatch. Leave NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID unset and none of this
 * code is ever fetched.
 */
export async function startAnalytics(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!firebaseConfigured || !config.measurementId) return;

  const instance = firebaseApp();
  if (!instance) return;

  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(instance);
  } catch {
    // Analytics is telemetry, not function. A blocked script, an ad blocker or
    // an unsupported browser must never take the storefront down with it.
  }
}

/**
 * The browser pop-up resolver, told to set itself up during auth start-up.
 *
 * Firebase already does this — but only where `_shouldInitProactively` is
 * true, which it defines as Safari, iOS and mobile. Those are the browsers it
 * knows enforce the user-gesture rule strictly, and the eager path exists
 * precisely so `window.open` can happen inside the click. Desktop Chrome is
 * left on the lazy path and enforces the same rule anyway — which is how
 * sign-in came to open its window three seconds late and be blocked.
 *
 * Subclassing to widen that condition asks Firebase to do its own eager
 * set-up everywhere, through its own machinery. It also fails safe: if a
 * future SDK stops consulting this getter the override is simply ignored, and
 * behaviour returns to today's with the redirect fallback still behind it.
 *
 * Built on first use rather than at module scope: `browserPopupRedirectResolver`
 * is browser-only, and on the server it is an object that cannot be extended —
 * evaluating this eagerly failed the production build during prerendering.
 */
let eagerResolver: typeof browserPopupRedirectResolver | undefined;

function popupResolver(): typeof browserPopupRedirectResolver {
  if (eagerResolver) return eagerResolver;

  try {
    eagerResolver = class extends (browserPopupRedirectResolver as unknown as {
      new (): object;
    }) {
      get _shouldInitProactively(): boolean {
        return true;
      }
    } as unknown as typeof browserPopupRedirectResolver;
  } catch {
    // Not extensible in this environment — use Firebase's own resolver.
    eagerResolver = browserPopupRedirectResolver;
  }

  return eagerResolver;
}

let auth: Auth | undefined;

/**
 * The Auth instance, built with the pop-up resolver already attached.
 *
 * `getAuth()` creates an instance with *no* popup resolver, so the first
 * `signInWithPopup` has to load Google's gapi bundle and mount the auth iframe
 * before it can open anything — which is what put `window.open` seconds after
 * the click and got the window blocked. Naming the resolver in
 * `initializeAuth` moves that setup into page load instead.
 */
export function firebaseAuth(): Auth | undefined {
  if (auth) return auth;

  const instance = firebaseApp();
  if (!instance) return undefined;

  auth = initializeAuth(instance, {
    // The order Firebase itself uses: IndexedDB where it works, localStorage
    // where it does not (Safari private browsing, some in-app webviews).
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: popupResolver(),
  });

  return auth;
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser: a shared machine should not silently reuse the
  // last person's Google account.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Gets the popup machinery ready *before* the shopper clicks.
 *
 * This is the fix for sign-in being blocked, and it is worth explaining
 * because the symptom pointed somewhere else entirely.
 *
 * `signInWithPopup` does not open a window and then talk to Google. It first
 * awaits the popup resolver's initialisation — which loads Google's gapi
 * bundle, mounts the hidden auth iframe on the Firebase auth domain, and
 * fetches the project config — and only opens the window once all of that has
 * resolved. Measured against production, that was **3,346 ms after the click**.
 *
 * No browser accepts a `window.open` three seconds after the gesture that was
 * supposed to have caused it. Chrome, Safari and Firefox all treat it as an
 * unrequested pop-up and block it, and Firebase surfaces that as
 * `auth/popup-blocked` — which read as "your browser blocked us" when the real
 * cause was that we asked too late.
 *
 * Running the same initialisation on mount moves every one of those round
 * trips off the click. By the time anyone presses the button the resolver is
 * warm, so `window.open` happens inside the click handler where the browser
 * still trusts it.
 *
 * `getRedirectResult` is used to do the warming because it initialises exactly
 * the same resolver, and because it has to be called anyway to finish a
 * redirect sign-in. One call, both jobs.
 *
 * @returns the ID token when the page has just come back from a redirect
 *          sign-in, otherwise null.
 */
export async function warmGoogleSignIn(): Promise<string | null> {
  const auth = firebaseAuth();
  if (!auth) return null;

  try {
    await auth.authStateReady();

    // Load gapi and mount the auth iframe *now*, so the click does not have to.
    //
    // This is the step that actually moves the work. Neither `initializeAuth`
    // nor `getRedirectResult` does it on a desktop browser: `getRedirectResult`
    // returns early when no redirect is pending, and the resolver only
    // self-initialises where its own `_shouldInitProactively` is true — which
    // Firebase sets for Safari, iOS and mobile *for this very reason*, and
    // leaves false on desktop Chrome. Calling it here asks for the same eager
    // setup Firebase already performs on the browsers it knows are strict.
    //
    // It is an internal method, so it is called defensively: if a future SDK
    // renames it this throws, we swallow it, and sign-in simply falls back to
    // the old behaviour — a slower pop-up, with the redirect path behind it.
    const proactive = browserPopupRedirectResolver as unknown as {
      _initialize?: (a: Auth) => Promise<unknown>;
    };
    await proactive._initialize?.(auth);

    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    return result ? await result.user.getIdToken() : null;
  } catch {
    // Warming is an optimisation and finishing a redirect is a best effort;
    // neither is allowed to break the page that called it.
    return null;
  }
}

/**
 * Runs Google sign-in and returns the Firebase ID token.
 *
 * The token is all that leaves this module — the caller posts it to Laravel,
 * which verifies the signature before believing any claim inside it.
 *
 * Must be called synchronously from the click. Anything awaited before this
 * point spends the browser's user-gesture allowance and the pop-up is blocked.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = firebaseAuth();

  if (!auth) {
    throw new Error("Google sign-in is not configured for this site.");
  }

  const credential = await signInWithPopup(auth, googleProvider(), popupResolver());
  return credential.user.getIdToken();
}

/**
 * The same sign-in, as a full-page redirect.
 *
 * Only used when a pop-up was genuinely refused — someone who blocks pop-ups
 * site-wide would otherwise have no way in at all. It leaves the site and
 * returns to the same URL, where `warmGoogleSignIn` picks the result up.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const auth = firebaseAuth();

  if (!auth) {
    throw new Error("Google sign-in is not configured for this site.");
  }

  await signInWithRedirect(auth, googleProvider(), popupResolver());
}

/**
 * Ends the Firebase half of the session.
 *
 * 2KONECT's own session is the Sanctum token; this exists so that signing out of
 * 2KONECT does not leave a Firebase session behind that would skip the account
 * chooser on the next sign-in.
 */
export async function signOutOfFirebase(): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) return;

  const { signOut } = await import("firebase/auth");
  await signOut(auth).catch(() => undefined);
}
