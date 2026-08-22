"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import shop from "@/lib/shop";
import type { VendorApplication } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { CheckIcon, GlobeIcon, ShieldIcon, TruckIcon } from "@/components/sourcing/icons";
import { Button, ButtonLink, Notice, Skeleton } from "@/components/ui/Primitives";

/**
 * Sell with 2KONECT.
 *
 * Registering an account does not make anyone a seller here. An application
 * lands in the admin queue, a person reviews it, and approval is what creates
 * the store — which is what keeps the storefront's seller list worth trusting.
 *
 * The page says so plainly rather than implying instant access and
 * disappointing the applicant afterwards.
 */
export default function SellPage() {
  const t = useT();
  const { user, isAuthenticated, ready, requireAuth } = useAuth();

  const [existing, setExisting] = useState<VendorApplication | null | undefined>(undefined);
  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    phone: "",
    email: "",
    region: "",
    city: BRAND.city,
    business_type: "individual",
    category: "",
    products: "",
    website: "",
    id_number: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<VendorApplication | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      full_name: current.full_name || user.name,
      email: current.email || user.email,
      phone: current.phone || (user.phone ?? ""),
    }));
  }, [user]);

  // Show an applicant their existing case rather than a blank form.
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { setExisting(null); return; }

    shop.myApplication().then(setExisting).catch(() => setExisting(null));
  }, [ready, isAuthenticated]);

  const isVendor = user?.role === "vendor";

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await shop.applyToSell({
        full_name: form.full_name.trim(),
        business_name: form.business_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        region: form.region.trim() || undefined,
        city: form.city.trim() || undefined,
        business_type: form.business_type,
        category: form.category.trim() || undefined,
        products: form.products.trim() || undefined,
        website: form.website.trim() || undefined,
        id_number: form.id_number.trim() || undefined,
      });

      setSubmitted(result.application);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(apiError(err, t("sell.applyFailed")));
      setSubmitting(false);
    }
  }

  const application = submitted ?? (existing || null);

  return (
    <SiteChrome>
      {/* ---- pitch ---- */}
      <section className="brand-ground">
        <div className="shell grid gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
              {t("sell.eyebrow")}
            </p>
            <h1 className="mt-1 text-[30px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[42px]">
              {t("sell.heroTitle", { brand: BRAND.name })}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
              {t("sell.heroBody", { country: BRAND.country })}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="#apply"
                className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-sm)] bg-white px-7 text-[15px] font-bold text-[color:var(--color-brand)] transition-transform hover:-translate-y-0.5"
              >
                {isVendor ? t("sell.openConsole") : t("sell.applyToSell")}
              </a>
              <Link
                href="/help/contact"
                prefetch={false}
                className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-sm)] border border-white/30 px-6 text-[15px] font-bold text-white hover:bg-white/10"
              >
                {t("sell.talkFirst")}
              </Link>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: <GlobeIcon className="h-5 w-5" />, title: t("sell.benefit1"), note: t("sell.benefit1Note") },
              { icon: <ShieldIcon className="h-5 w-5" />, title: t("sell.benefit2"), note: t("sell.benefit2Note") },
              { icon: <TruckIcon className="h-5 w-5" />, title: t("sell.benefit3"), note: t("sell.benefit3Note", { brand: BRAND.name }) },
              { icon: <CheckIcon className="h-5 w-5" />, title: t("sell.benefit4"), note: t("sell.benefit4Note") },
            ].map((item) => (
              <li key={item.title} className="rounded-[var(--radius-md)] bg-white/10 p-4">
                <span className="text-[color:var(--color-brand-200)]">{item.icon}</span>
                <p className="mt-2 text-[14px] font-extrabold text-white">{item.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/70">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- how approval works ---- */}
      <section className="shell py-8">
        <h2 className="text-[20px] font-black tracking-[-0.02em] sm:text-[24px]">
          {t("sell.howItWorks")}
        </h2>
        <ol className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-line)] sm:grid-cols-4">
          {[
            { title: t("sell.step1"), note: t("sell.step1Note") },
            { title: t("sell.step2"), note: t("sell.step2Note") },
            { title: t("sell.step3"), note: t("sell.step3Note") },
            { title: t("sell.step4"), note: t("sell.step4Note") },
          ].map((step, index) => (
            <li key={step.title} className="bg-[color:var(--color-surface)] p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[13px] font-black text-[color:var(--color-brand)]">
                {index + 1}
              </span>
              <p className="mt-2.5 text-[15px] font-extrabold">{step.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
                {step.note}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- application ---- */}
      <div id="apply" className="shell pb-tabbar">
        {isVendor ? (
          <div className="mx-auto max-w-2xl rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 text-center">
            <h2 className="text-[20px] font-black">{t("sell.alreadySell")}</h2>
            <p className="mt-1.5 text-[14px] text-[color:var(--color-ink-muted)]">
              {t("sell.alreadySellNote")}
            </p>
            <ButtonLink href="/vendor/dashboard" size="lg" className="mt-4">
              {t("sell.openSellerConsole")}
            </ButtonLink>
          </div>
        ) : existing === undefined ? (
          <Skeleton className="mx-auto h-56 max-w-2xl rounded-[var(--radius-md)]" />
        ) : application ? (
          <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-surface)] p-6 text-center sm:p-9">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white">
              <CheckIcon className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-[22px] font-black tracking-[-0.02em]">
              {application.status === "approved" ? t("sell.approvedTitle") : t("sell.receivedTitle")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--color-ink-soft)]">
              {application.status === "approved"
                ? t("sell.approvedBody")
                : t("sell.receivedBody", { name: application.business_name })}
            </p>

            <p className="mt-4 inline-flex flex-col items-center rounded-[var(--radius-md)] bg-[color:var(--color-brand-50)] px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                {application.status_label}
              </span>
              <span className="text-[19px] font-black tracking-wide">{application.reference}</span>
            </p>

            {application.note ? (
              <Notice tone={application.status === "rejected" ? "warn" : "info"} className="mt-4 text-left">
                {application.note}
              </Notice>
            ) : null}

            <div className="mt-5">
              <ButtonLink href="/shop" variant="secondary">{t("sell.backToShop")}</ButtonLink>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
            <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
              <h2 className="text-[18px] font-black">{t("sell.applyToSell")}</h2>
              <p className="mt-1 text-[13px] text-[color:var(--color-ink-muted)]">
                {t("sell.nothingLive")}
              </p>

              {!isAuthenticated ? (
                <Notice tone="info" className="mt-3">
                  {t("sell.noticeBefore")}{" "}
                  <button
                    type="button"
                    onClick={() => void requireAuth()}
                    className="font-bold underline"
                  >
                    {t("sell.signingInFirst")}
                  </button>{" "}
                  {t("sell.noticeAfter")}
                </Notice>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={t("sell.businessName")} value={form.business_name} onChange={(v) => set("business_name", v)} required placeholder={t("sell.businessNamePlaceholder")} />
                <Field label={t("sell.yourName")} value={form.full_name} onChange={(v) => set("full_name", v)} required placeholder={t("sell.contactPerson")} />
                <Field label={t("sell.phone")} value={form.phone} onChange={(v) => set("phone", v)} required inputMode="tel" placeholder={t("checkout.phonePlaceholder")} />
                <Field label={t("sell.email")} value={form.email} onChange={(v) => set("email", v)} type="email" placeholder="you@example.com" />

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">{t("sell.businessType")}</span>
                  <select
                    value={form.business_type}
                    onChange={(event) => set("business_type", event.target.value)}
                    className={`${FIELD} h-12`}
                  >
                    <option value="individual">{t("sell.typeIndividual")}</option>
                    <option value="registered">{t("sell.typeRegistered")}</option>
                    <option value="company">{t("sell.typeCompany")}</option>
                    <option value="importer">{t("sell.typeImporter")}</option>
                  </select>
                </label>

                <Field label={t("sell.mainCategory")} value={form.category} onChange={(v) => set("category", v)} placeholder={t("sell.mainCategoryPlaceholder")} />
                <Field label={t("sell.region")} value={form.region} onChange={(v) => set("region", v)} placeholder={BRAND.city} />
                <Field label={t("sell.cityArea")} value={form.city} onChange={(v) => set("city", v)} placeholder={BRAND.city} />
                <Field label={t("sell.websiteOptional")} value={form.website} onChange={(v) => set("website", v)} placeholder="instagram.com/yourshop" />
                <Field label={t("sell.idOptional")} value={form.id_number} onChange={(v) => set("id_number", v)} placeholder={t("sell.idPlaceholder")} />
              </div>

              <div className="mt-3">
                <Field
                  label={t("sell.whatSell")}
                  value={form.products}
                  onChange={(v) => set("products", v)}
                  multiline
                  placeholder={t("sell.whatSellPlaceholder")}
                />
              </div>
            </section>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" loading={submitting}>
                {submitting ? t("sell.sending") : t("sell.submitApplication")}
              </Button>
              <p className="text-[12px] text-[color:var(--color-ink-muted)]">
                {t("sell.freeToApply")}
              </p>
            </div>

            <p className="text-[12px] leading-relaxed text-[color:var(--color-ink-faint)]">
              {t("sell.termsPrefix", { brand: BRAND.name })}{" "}
              <Link href="/legal/terms" className="underline">{t("sell.sellerTerms", { brand: BRAND.name })}</Link>{" "}
              {t("sell.and")}{" "}
              <Link href="/sell/guidelines" className="underline">{t("sell.listingGuidelines")}</Link>.
            </p>
          </form>
        )}
      </div>
    </SiteChrome>
  );
}

const FIELD =
  "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none transition-colors focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand-200)]";

function Field({
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
