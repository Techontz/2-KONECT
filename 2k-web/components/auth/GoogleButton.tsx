"use client";

import { useEffect, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";

import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import {
  firebaseConfigured,
  signInWithGoogle,
  signInWithGoogleRedirect,
  warmGoogleSignIn,
} from "@/lib/firebase";
import { useAuth } from "@/lib/store/auth";

/**
 * "Continue with Google" for shoppers.
 *
 * Google → Firebase → Firebase ID token → Laravel → Sanctum. The button owns
 * only the first hop; the moment a token exists it is handed to the auth store,
 * which persists the Sanctum session exactly as a password login does.
 *
 * The control is drawn from the storefront's own tokens — radius, border, type
 * scale — rather than Google's rendered widget, so it sits inside the existing
 * sheet instead of importing a second design language. Google's mark is the one
 * part reproduced to their spec.
 *
 * Firebase is warmed as soon as the button is on screen. `signInWithPopup`
 * loads gapi, the auth iframe and the project config *before* it opens the
 * window, which in production put `window.open` 3.3 seconds after the click —
 * long past the point a browser still credits the gesture, so the pop-up was
 * blocked every time. Warming on mount moves that work off the click; see
 * lib/firebase.ts.
 */
export function GoogleButton({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const { loginWithGoogle } = useAuth();

  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `onDone` is called from an effect below; a ref keeps that effect from
  // re-running every time the parent re-creates the callback.
  const done = useRef(onDone);
  done.current = onDone;

  /* ---- warm the pop-up, and finish a redirect if we are coming back ---- */
  useEffect(() => {
    if (!firebaseConfigured) return;
    let live = true;

    warmGoogleSignIn()
      .then(async (idToken) => {
        if (!live || !idToken) return;
        // The page has just returned from a full-page Google sign-in.
        setBusy(true);
        try {
          await loginWithGoogle(idToken);
          done.current?.();
        } catch (e) {
          setError(apiError(e, t("auth.googleFailed")));
        } finally {
          if (live) setBusy(false);
        }
      })
      .catch(() => undefined);

    return () => { live = false; };
  }, [loginWithGoogle, t]);

  // Nothing to sign in to without configuration, so the control is hidden
  // rather than shown as a button that cannot work.
  if (!firebaseConfigured) return null;

  const start = async () => {
    setBusy(true);
    setError(null);

    try {
      const idToken = await signInWithGoogle();
      await loginWithGoogle(idToken);
      done.current?.();
    } catch (e) {
      if (e instanceof FirebaseError) {
        // Closing the pop-up is a decision, not a failure.
        if (
          e.code === "auth/popup-closed-by-user" ||
          e.code === "auth/cancelled-popup-request" ||
          e.code === "auth/user-cancelled"
        ) {
          return;
        }

        // Genuinely refused — the shopper blocks pop-ups site-wide, or an
        // extension does. Rather than leaving them at a dead end, go the long
        // way round: a full-page redirect needs no pop-up at all, and
        // `warmGoogleSignIn` completes it when the browser comes back.
        if (e.code === "auth/popup-blocked") {
          setRedirecting(true);
          try {
            await signInWithGoogleRedirect();
            return;
          } catch {
            setRedirecting(false);
            setError(t("auth.popupBlocked", { brand: BRAND.name }));
            return;
          }
        }

        if (e.code === "auth/unauthorized-domain" || e.code === "auth/operation-not-allowed") {
          // Configuration, not user error — say so plainly.
          setError(t("auth.googleUnavailable"));
          return;
        }

        if (e.code === "auth/network-request-failed") {
          setError(t("auth.googleNetwork"));
          return;
        }

        // Any other Firebase code is ours to explain, not the shopper's to
        // decode. Naming the browser here is what made a timing bug in this
        // component look like a setting on their machine.
        setError(t("auth.googleFailed"));
        return;
      }

      // A seller/staff email is refused by the backend by design; its message
      // explains what to do instead, so it is surfaced verbatim. Anything that
      // arrives without a message falls back to the honest generic line.
      setError(apiError(e, t("auth.googleFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-[color:var(--color-line)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
          {t("auth.or")}
        </span>
        <span className="h-px flex-1 bg-[color:var(--color-line)]" />
      </div>

      <button
        type="button"
        disabled={busy || redirecting}
        onClick={start}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white text-sm font-bold text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-surface-alt)] disabled:opacity-60"
      >
        <GoogleMark />
        {redirecting ? t("auth.googleRedirecting") : busy ? t("auth.pleaseWait") : t("auth.continueWithGoogle")}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[var(--radius-sm)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Google's mark, reproduced to their brand spec. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default GoogleButton;
