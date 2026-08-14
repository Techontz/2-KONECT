"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/store/auth";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Button, ButtonLink } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * Seller acquisition page and application form.
 *
 * A vendor account is created through the same `/register` endpoint the rest
 * of the site uses, with `role: vendor` — the marketplace's existing approval
 * rule then decides when the store goes live, which is deliberately not
 * bypassed here.
 */
export default function SellPage() {
  const t = useT();
  const router = useRouter();
  const { user, isAuthenticated, register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    business_name: "",
    business_address: "",
    nida_number: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });
  // Files live outside the text state: the backend requires a shop image and
  // a licence document, and without them registration is rejected.
  const [logo, setLogo] = useState<File | null>(null);
  const [licence, setLicence] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      // Seller registration is multipart: the backend requires an avatar and a
      // business licence alongside the text fields. The previous JSON form
      // could never satisfy it, so every application failed on submit.
      const body = new FormData();
      body.append("name", form.name.trim());
      body.append("email", form.email.trim());
      body.append("phone", form.phone.trim());
      body.append("password", form.password);
      body.append("password_confirmation", form.password_confirmation);
      body.append("role", "vendor");
      body.append("business_name", form.business_name.trim());
      body.append("business_address", form.business_address.trim());
      body.append("nida_number", form.nida_number.trim());
      if (logo) body.append("avatar", logo);
      if (licence) body.append("business_license", licence);

      await register(body);
      router.push("/vendor/dashboard");
    } catch (err) {
      setError(apiError(err, t("sell.failed")));
      setBusy(false);
    }
  }

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  return (
    <SiteChrome>
      <div className="bg-[color:var(--color-brand)]">
        <div className="shell grid gap-6 py-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest opacity-70">
              Sell on {BRAND.short}
            </p>
            <h1 className="mt-1 text-[34px] font-black leading-[1.05] md:text-[44px]">
              Reach shoppers across {BRAND.country}
            </h1>
            <p className="mt-3 max-w-lg text-[15px] opacity-80">
              List your products, manage your own stock and prices, and get paid for every
              delivered order. No shopfront required.
            </p>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                ["🚚", t("sell.perk1"), t("sell.perk1Hint")],
                ["📊", t("sell.perk2"), t("sell.perk2Hint")],
                ["💳", t("sell.perk3"), t("sell.perk3Hint")],
                ["🛡️", t("sell.perk4"), t("sell.perk4Hint")],
              ].map(([icon, title, body]) => (
                <li key={title} className="flex gap-2.5 rounded-[var(--radius-md)] bg-white/40 p-3">
                  <span aria-hidden="true" className="text-lg">{icon}</span>
                  <span>
                    <span className="block text-[13px] font-bold">{title}</span>
                    <span className="text-[12px] opacity-70">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---- application ---- */}
          <div className="rounded-[var(--radius-lg)] bg-white p-5 shadow-[var(--shadow-pop)]">
            {isAuthenticated && user?.role === "vendor" ? (
              <div className="py-6 text-center">
                <p className="text-[18px] font-black">You're already a seller</p>
                <p className="mt-1 text-[13px] text-[color:var(--color-ink-muted)]">
                  {user.vendor?.is_approved
                    ? t("sell.approved")
                    : t("sell.awaiting")}
                </p>
                <ButtonLink href="/vendor/dashboard" size="lg" className="mt-4 w-full">Open seller console</ButtonLink>
              </div>
            ) : isAuthenticated ? (
              <div className="py-6 text-center">
                <p className="text-[18px] font-black">{t("sell.upgradeTitle")}</p>
                <p className="mt-1 text-[13px] text-[color:var(--color-ink-muted)]">
                  {t("sell.upgradeBody")}{" "}
                  <a href={`mailto:${BRAND.supportEmail}`} className="font-bold text-[color:var(--color-action)] hover:underline">
                    {BRAND.supportEmail}
                  </a>{" "}
                  {t("sell.upgradeTail")}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-[18px] font-black">{t("sell.getStarted")}</h2>
                <p className="mb-4 text-[13px] text-[color:var(--color-ink-muted)]">
                  {t("sell.awaiting")}
                </p>

                <form onSubmit={submit} className="space-y-3">
                  <Field label={t("auth.businessName")} required value={form.business_name}
                    onChange={update("business_name")} placeholder="e.g. Kariakoo Mobile Hub" />
                  <Field label={t("sell.yourName")} required value={form.name} onChange={update("name")} />

                  <Field
                    label={t("sell.nida")}
                    required
                    inputMode="numeric"
                    maxLength={20}
                    pattern="[0-9]{20}"
                    title={t("sell.nidaError")}
                    value={form.nida_number}
                    onChange={update("nida_number")}
                  />
                  <p className="-mt-1 text-[11px] text-[color:var(--color-ink-muted)]">
                    {t("sell.nidaHint")}
                  </p>

                  <Field
                    label={t("sell.businessAddress")}
                    required
                    value={form.business_address}
                    onChange={update("business_address")}
                    placeholder={t("sell.businessAddressHint")}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("auth.email")} type="email" required value={form.email} onChange={update("email")} />
                    <Field label={t("auth.phone")} required inputMode="tel" value={form.phone}
                      onChange={update("phone")} placeholder="07XX XXX XXX" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("auth.password")} type="password" required value={form.password}
                      onChange={update("password")} autoComplete="new-password" />
                    <Field label={t("auth.confirmPassword")} type="password" required
                      value={form.password_confirmation} onChange={update("password_confirmation")}
                      autoComplete="new-password" />
                  </div>

                  <fieldset className="rounded-[var(--radius-sm)] border border-[color:var(--color-line)] p-3">
                    <legend className="px-1 text-[12px] font-bold">{t("sell.documents")}</legend>
                    <p className="mb-2 text-[11px] text-[color:var(--color-ink-muted)]">
                      {t("sell.documentsNote")}
                    </p>

                    <FileField
                      label={t("sell.logo")}
                      hint={t("sell.logoHint")}
                      accept="image/jpeg,image/png"
                      file={logo}
                      onChange={setLogo}
                    />
                    <FileField
                      label={t("sell.licence")}
                      hint={t("sell.licenceHint")}
                      accept="image/jpeg,image/png,application/pdf"
                      file={licence}
                      onChange={setLicence}
                    />
                  </fieldset>

                  {error ? (
                    <p role="alert" className="rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-[13px] text-[color:var(--color-sale)]">
                      {error}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? t("sell.creating") : t("auth.createSellerAccount")}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
        {label}
      </span>
      <input
        {...props}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-sm outline-none focus:border-[color:var(--color-action)]"
      />
    </label>
  );
}

/** File input styled to match the text fields, showing the chosen filename. */
function FileField({
  label,
  hint,
  accept,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange(file: File | null): void;
}) {
  return (
    <label className="mt-2 block">
      <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
        {label}
      </span>
      <input
        type="file"
        required
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full text-[12px] file:mr-3 file:rounded-[var(--radius-xs)] file:border-0 file:bg-[color:var(--color-ink)] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white"
      />
      <span className="mt-1 block text-[11px] text-[color:var(--color-ink-faint)]">
        {file ? file.name : hint}
      </span>
    </label>
  );
}
