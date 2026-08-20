"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/api";
import { useAuth } from "@/lib/store/auth";
import { Button } from "@/components/ui/Primitives";
import { Logo } from "@/components/brand/Logo";
import { GoogleButton } from "@/components/auth/GoogleButton";

/**
 * Modal sign-in / sign-up.
 *
 * This is how the storefront asks for an identity: never at the door, only at
 * the point a protected action actually needs one (checkout, orders,
 * server-side wishlist). Dismissing it returns the visitor to exactly where
 * they were, with their cart intact.
 */
export function AuthSheet() {
  const t = useT();
  const { authPromptOpen, closeAuthPrompt, login, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });

  // Close on Escape, and stop the page behind from scrolling while open.
  useEffect(() => {
    if (!authPromptOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAuthPrompt();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [authPromptOpen, closeAuthPrompt]);

  useEffect(() => {
    if (!authPromptOpen) setError(null);
  }, [authPromptOpen]);

  if (!authPromptOpen) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "login") {
        await login(form.email.trim(), form.password);
        // The provider closes the sheet the moment a session exists.
      } else {
        await signUp({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          password_confirmation: form.password_confirmation,
          role: "user",
        });

        // Hand the new account straight to the login step rather than
        // leaving the shopper looking at the form they just submitted.
        setMode("login");
        setNotice(t("auth.registered"));
        setForm((current) => ({ ...current, password: "", password_confirmation: "" }));
      }
    } catch (err) {
      setError(apiError(err, t("auth.failed")));
    } finally {
      setBusy(false);
    }
  }

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? t("auth.login") : t("auth.createAccount")}
      onClick={closeAuthPrompt}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-t-[var(--radius-lg)] bg-white sm:rounded-[var(--radius-lg)]"
      >
        <button
          type="button"
          onClick={closeAuthPrompt}
          aria-label={t("common.close")}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="brand-ground px-6 py-7 text-center">
          <Logo tone="dark" size="lg" className="justify-center" />
          <p className="mt-2.5 text-sm font-semibold text-white/80">
            {mode === "login" ? t("auth.welcomeBack") : t("auth.join", { brand: BRAND.name })}
          </p>
        </div>

        <div className="p-6">
          <div className="mb-5 grid grid-cols-2 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] p-1">
            {(["login", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => { setMode(value); setError(null); setNotice(null); }}
                className={`rounded-[var(--radius-xs)] py-2 text-sm font-bold transition-colors ${
                  mode === value
                    ? "bg-[color:var(--color-brand)] text-white"
                    : "text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-alt)]"
                }`}
              >
                {value === "login" ? t("auth.login") : t("auth.signup")}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" ? (
              <>
                <Field label={t("auth.name")} value={form.name} onChange={update("name")} required autoComplete="name" />
                <Field label={t("auth.phone")} value={form.phone} onChange={update("phone")} required
                  inputMode="tel" placeholder="07XX XXX XXX" autoComplete="tel" />
              </>
            ) : null}

            <Field label={t("auth.email")} type="email" value={form.email} onChange={update("email")}
              required autoComplete="email" />
            <Field label={t("auth.password")} type="password" value={form.password} onChange={update("password")}
              required autoComplete={mode === "login" ? "current-password" : "new-password"} />

            {mode === "register" ? (
              <Field label={t("auth.confirmPassword")} type="password" value={form.password_confirmation}
                onChange={update("password_confirmation")} required autoComplete="new-password" />
            ) : null}

            {notice ? (
              <p role="status" className="rounded-[var(--radius-sm)] bg-[color:var(--color-success-soft)] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-success)]">
                {notice}
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-[var(--radius-sm)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-danger)]">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? t("auth.pleaseWait") : mode === "login" ? t("auth.login") : t("auth.createAccountBtn")}
            </Button>
          </form>

          {/* Shoppers only — sellers and staff sign in with a password. */}
          <GoogleButton onDone={closeAuthPrompt} />

          <p className="mt-4 text-center text-[11px] leading-relaxed text-[color:var(--color-ink-faint)]">
            {t("auth.termsNote", { brand: BRAND.name })}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-sm outline-none transition-colors focus:border-[color:var(--color-brand)]"
      />
    </label>
  );
}

export default AuthSheet;
