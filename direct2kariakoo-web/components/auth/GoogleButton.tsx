"use client";

import { useState } from "react";
import { FirebaseError } from "firebase/app";

import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/api";
import { firebaseConfigured, signInWithGoogle } from "@/lib/firebase";
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
 */
export function GoogleButton({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const { loginWithGoogle } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing to sign in to without configuration, so the control is hidden
  // rather than shown as a button that cannot work.
  if (!firebaseConfigured) return null;

  const start = async () => {
    setBusy(true);
    setError(null);

    try {
      const idToken = await signInWithGoogle();
      await loginWithGoogle(idToken);
      onDone?.();
    } catch (e) {
      if (e instanceof FirebaseError) {
        // Closing the popup is a decision, not a failure.
        if (
          e.code === "auth/popup-closed-by-user" ||
          e.code === "auth/cancelled-popup-request"
        ) {
          return;
        }

        if (e.code === "auth/popup-blocked") {
          setError(t("auth.popupBlocked"));
          return;
        }

        if (e.code === "auth/unauthorized-domain") {
          // Configuration, not user error — say so plainly.
          setError(t("auth.googleUnavailable"));
          return;
        }
      }

      // A seller/staff email is refused by the backend by design; its message
      // explains what to do instead, so it is surfaced verbatim.
      setError(apiError(e));
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
        disabled={busy}
        onClick={start}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white text-sm font-bold text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-surface-alt)] disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? t("auth.pleaseWait") : t("auth.continueWithGoogle")}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-[13px] text-[color:var(--color-sale)]"
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
