"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { COUNTRIES } from "@/lib/countries";
import shop from "@/lib/shop";
import type { SourcingRequest } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { GlobeIcon, SendIcon, ShieldIcon } from "@/components/sourcing/icons";
import { Button, ButtonLink, Notice, Skeleton } from "@/components/ui/Primitives";

/**
 * Request a product.
 *
 * The catalogue will never carry everything, and a shopper who cannot find
 * something is otherwise a shopper who leaves. This turns that moment into a
 * service: describe it, photograph it, and a real person sources it.
 *
 * Deliberately open to signed-out visitors — asking someone to register before
 * they can tell us what they want is how you never find out what they want.
 */
/** The countries the sourcing desk actually buys from today. */
const SOURCE_CHOICES = ["CN", "AE", "US", "GB", "TR", "IN", "JP", "ZA"] as const;

const URGENCIES = [
  { value: "standard", label: "request.noRush" },
  { value: "soon", label: "request.soon" },
  { value: "urgent", label: "request.urgent" },
] as const;

export default function RequestPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-8"><Skeleton className="h-64 w-full" /></div>}>
        <RequestContent />
      </Suspense>
    </SiteChrome>
  );
}

function RequestContent() {
  const t = useT();
  const params = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [name, setName] = useState(params.get("name") ?? "");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [preferredCountry, setPreferredCountry] = useState("");
  const [urgency, setUrgency] = useState<"standard" | "soon" | "urgent">("standard");
  const [quantity, setQuantity] = useState(1);
  const [budget, setBudget] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState<string>(BRAND.city);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SourcingRequest | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill from the account when there is one, so a signed-in shopper types
  // as little as possible.
  useEffect(() => {
    if (!user) return;
    setContactName((current) => current || user.name);
    setEmail((current) => current || user.email);
    setPhone((current) => current || (user.phone ?? ""));
  }, [user]);

  // Object URLs are a resource; release the previous one on every change.
  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await shop.requestProduct({
        name: name.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        preferred_country: preferredCountry || undefined,
        // Sent only when it is not the default, so "standard" is recorded as
        // "they did not ask for anything special" rather than as a choice.
        urgency: urgency !== "standard" ? urgency : undefined,
        quantity,
        budget_max: budget ? Number(budget) : undefined,
        contact_name: contactName.trim(),
        contact_phone: phone.trim(),
        contact_email: email.trim() || undefined,
        delivery_city: city.trim() || undefined,
        image,
      });

      setDone(result.request);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(apiError(err, t("request.sendFailed")));
      setSubmitting(false);
    }
  }

  /* ---- confirmation ---- */
  if (done) {
    return (
      <div className="shell py-8 pb-tabbar">
        <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-surface)] p-6 text-center sm:p-9">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>

          <h1 className="mt-4 text-[24px] font-black tracking-[-0.025em]">{t("request.received")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--color-ink-soft)]">
            {t("request.receivedBody", { brand: BRAND.name })}{" "}
            <span className="font-bold">{done.name}</span>. {t("request.receivedBodyEnd")}
          </p>

          <p className="mt-4 inline-flex flex-col items-center rounded-[var(--radius-md)] bg-[color:var(--color-brand-50)] px-5 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
              {t("request.yourReference")}
            </span>
            <span className="text-[20px] font-black tracking-wide">{done.reference}</span>
          </p>

          <ol className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
            {[
              t("request.step1"),
              t("request.step2"),
              t("request.step3"),
              t("request.step4"),
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5 text-[13px] leading-relaxed">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[11px] font-black text-[color:var(--color-brand)]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {isAuthenticated ? (
              <ButtonLink href="/account/requests" size="lg">{t("request.trackThis")}</ButtonLink>
            ) : (
              <p className="text-[13px] text-[color:var(--color-ink-muted)]">
                {t("request.willCallBefore")} <span className="font-bold">{phone}</span>.{" "}
                {t("request.willCallAfter")}
              </p>
            )}
            <ButtonLink href="/shop" size="lg" variant="secondary">{t("request.keepShopping")}</ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  /* ---- the form ---- */
  return (
    <>
      <section className="brand-ground">
        <div className="shell py-8 sm:py-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            {t("request.eyebrow")}
          </p>
          <h1 className="mt-1 max-w-2xl text-[28px] font-black leading-tight tracking-[-0.025em] text-white sm:text-[38px]">
            {t("request.heroTitle")}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-snug text-white/75 sm:text-[15px] sm:leading-relaxed">
            {t("request.heroBody", { country: BRAND.country })}
          </p>

          {/* Three short reassurances, wrapped rather than stacked: on a phone
              three full-width rows of one sentence each push the form itself
              off the screen, and the form is the point of the page. */}
          <ul className="mt-4 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
            {[
              { icon: <SendIcon className="h-3.5 w-3.5" />, text: t("request.noAccountNeeded") },
              { icon: <GlobeIcon className="h-3.5 w-3.5" />, text: t("request.sourcedAnywhere") },
              { icon: <ShieldIcon className="h-3.5 w-3.5" />, text: t("request.youApprove") },
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/12 px-2.5 py-1.5 text-[12px] font-semibold text-white sm:px-3 sm:py-2 sm:text-[13px]"
              >
                <span className="text-[color:var(--color-brand-200)]">{item.icon}</span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="shell py-6 pb-tabbar">
        <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
            <h2 className="text-[16px] font-black">{t("request.whatLookingFor")}</h2>

            {/* The photo comes first: for most requests it is the clearest
                description there is, and it is the least work to provide. */}
            <div className="mt-3">
              <span className="mb-1.5 block text-[13px] font-bold">{t("request.photoOptional")}</span>

              {preview ? (
                <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-line)] p-2">
                  <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded-[var(--radius-xs)] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{image?.name}</p>
                    <button
                      type="button"
                      onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="mt-1 text-[12px] font-bold text-[color:var(--color-sale)] hover:underline"
                    >
                      {t("request.removePhoto")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-line-strong)] px-4 py-7 text-center transition-colors hover:border-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-50)]"
                >
                  <CameraIcon className="h-7 w-7 text-[color:var(--color-brand)]" />
                  <span className="text-[14px] font-bold">{t("request.uploadPhoto")}</span>
                  <span className="text-[12px] text-[color:var(--color-ink-muted)]">
                    {t("request.uploadHint")}
                  </span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                className="sr-only"
                aria-label={t("request.productPhoto")}
              />
            </div>

            <div className="mt-4 space-y-3">
              <TextField
                label={t("request.whatIsIt")}
                value={name}
                onChange={setName}
                required
                placeholder={t("request.whatIsItPlaceholder")}
              />
              <TextField
                label={t("request.describeNeed")}
                value={description}
                onChange={setDescription}
                multiline
                placeholder={t("request.describePlaceholder")}
              />

              {/* Brand takes the row; the two short numeric fields share the
                  next one even on the narrowest phone — stacking three
                  full-width inputs here is what made this form feel endless. */}
              <TextField label={t("request.brandOptional")} value={brand} onChange={setBrand} placeholder="Apple" />

              {/* Where from, and how soon. Both change what the sourcing desk
                  actually does — an urgent request is quoted air freight, a
                  patient one goes by sea for a fraction of the price — so
                  they are asked here rather than discovered on the phone.
                  Both are optional: a photo and a name are still enough. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">
                    {t("request.buyFrom")}
                  </span>
                  <select
                    value={preferredCountry}
                    onChange={(event) => setPreferredCountry(event.target.value)}
                    className={`${FIELD} h-12`}
                  >
                    <option value="">{t("request.whereverBest")}</option>
                    {SOURCE_CHOICES.map((code) => (
                      <option key={code} value={code}>
                        {COUNTRIES[code].flag} {COUNTRIES[code].name}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="block">
                  <legend className="mb-1.5 block text-[13px] font-bold">{t("request.howSoon")}</legend>
                  <div className="flex gap-1.5">
                    {URGENCIES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        aria-pressed={urgency === choice.value}
                        onClick={() => setUrgency(choice.value)}
                        className={`h-12 flex-1 rounded-[var(--radius-sm)] border px-1 text-[12px] font-bold transition-colors ${
                          urgency === choice.value
                            ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                            : "border-[color:var(--color-line-strong)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand-200)]"
                        }`}
                      >
                        {t(choice.label)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">{t("request.quantity")}</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                    className={`${FIELD} h-12`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">{t("request.budgetOptional")}</span>
                  <input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="TZS"
                    className={`${FIELD} h-12`}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
            <h2 className="text-[16px] font-black">{t("request.howReachYou")}</h2>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-muted)]">
              {t("request.howReachYouHint")}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label={t("request.yourName")} value={contactName} onChange={setContactName} required placeholder={t("request.fullName")} />
              <TextField label={t("request.phone")} value={phone} onChange={setPhone} required inputMode="tel" placeholder={t("checkout.phonePlaceholder")} />
              <TextField label={t("request.emailOptional")} value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
              <TextField label={t("request.deliverTo")} value={city} onChange={setCity} placeholder={BRAND.city} />
            </div>
          </section>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={submitting}>
              {submitting ? t("request.sending") : t("request.submit")}
            </Button>
            <p className="text-[12px] text-[color:var(--color-ink-muted)]">
              {t("request.noPaymentNow")}
            </p>
          </div>

          <p className="text-[12px] text-[color:var(--color-ink-faint)]">
            {t("request.alreadySent")}{" "}
            <Link href="/account/requests" className="font-bold text-[color:var(--color-brand)] hover:underline">
              {t("request.checkRequests")}
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}

const FIELD =
  "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none transition-colors focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand-200)]";

function TextField({
  label,
  value,
  onChange,
  required,
  multiline,
  placeholder,
  inputMode,
  type = "text",
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: "tel" | "text";
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          rows={3}
          placeholder={placeholder}
          className={`${FIELD} resize-y py-2.5`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          placeholder={placeholder}
          inputMode={inputMode}
          className={`${FIELD} h-12`}
        />
      )}
    </label>
  );
}

function CameraIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5h3l1.6-2.4h6.8L17 8.5h3a1 1 0 011 1V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5a1 1 0 011-1z" />
      <circle cx="12" cy="13.5" r="3.4" />
    </svg>
  );
}
