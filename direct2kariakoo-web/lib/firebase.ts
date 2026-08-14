import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, type Auth } from "firebase/auth";

/**
 * Firebase Authentication for the storefront.
 *
 * Only Authentication is used, and only as an identity provider: Firebase says
 * who the shopper is, Laravel decides what that means for D2K and issues the
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
};

/** True once the deployment has been given its Firebase values. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;

function firebaseApp(): FirebaseApp | undefined {
  if (!firebaseConfigured) return undefined;
  if (app) return app;

  // Next's fast refresh can evaluate this module more than once.
  app = getApps().length ? getApps()[0] : initializeApp(config as Required<typeof config>);
  return app;
}

export function firebaseAuth(): Auth | undefined {
  const instance = firebaseApp();
  return instance ? getAuth(instance) : undefined;
}

/**
 * Runs Google sign-in and returns the Firebase ID token.
 *
 * The token is all that leaves this module — the caller posts it to Laravel,
 * which verifies the signature before believing any claim inside it.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = firebaseAuth();

  if (!auth) {
    throw new Error("Google sign-in is not configured for this site.");
  }

  const provider = new GoogleAuthProvider();
  // Always show the chooser: a shared machine should not silently reuse the
  // last person's Google account.
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  return credential.user.getIdToken();
}

/**
 * Ends the Firebase half of the session.
 *
 * D2K's own session is the Sanctum token; this exists so that signing out of
 * D2K does not leave a Firebase session behind that would skip the account
 * chooser on the next sign-in.
 */
export async function signOutOfFirebase(): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) return;

  const { signOut } = await import("firebase/auth");
  await signOut(auth).catch(() => undefined);
}
