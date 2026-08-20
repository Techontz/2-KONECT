"use client";

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
      setError(apiError(err, "We couldn’t send your application. Please check the details."));
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
              For businesses
            </p>
            <h1 className="mt-1 text-[30px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[42px]">
              Sell with {BRAND.name}.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
              Reach buyers across {BRAND.country} on a marketplace where every seller is
              reviewed before they list. Apply once — we handle approval, verification
              and the tools you need to run your shop.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="#apply"
                className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-sm)] bg-white px-7 text-[15px] font-bold text-[color:var(--color-brand)] transition-transform hover:-translate-y-0.5"
              >
                {isVendor ? "Open your console" : "Apply to sell"}
              </a>
              <Link
                href="/help/contact"
                prefetch={false}
                className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-sm)] border border-white/30 px-6 text-[15px] font-bold text-white hover:bg-white/10"
              >
                Talk to us first
              </Link>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: <GlobeIcon className="h-5 w-5" />, title: "A national shopfront", note: "Your products in front of buyers in every region we deliver to." },
              { icon: <ShieldIcon className="h-5 w-5" />, title: "Verification that means something", note: "Reviewed sellers carry a badge shoppers can rely on." },
              { icon: <TruckIcon className="h-5 w-5" />, title: "Delivery handled", note: "Orders route through 2KONECT delivery and tracking." },
              { icon: <CheckIcon className="h-5 w-5" />, title: "Real tools", note: "Products, stock, orders and payouts in one console." },
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
          How it works
        </h2>
        <ol className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-line)] sm:grid-cols-4">
          {[
            { title: "Apply", note: "Tell us who you are and what you want to sell." },
            { title: "We review", note: "A person reads every application — usually within a few days." },
            { title: "Get approved", note: "We create your seller account and open the console." },
            { title: "Start selling", note: "List products, take orders, get paid." },
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
            <h2 className="text-[20px] font-black">You already sell with us</h2>
            <p className="mt-1.5 text-[14px] text-[color:var(--color-ink-muted)]">
              Your seller console is where you manage products, stock and orders.
            </p>
            <ButtonLink href="/vendor/dashboard" size="lg" className="mt-4">
              Open seller console
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
              {application.status === "approved" ? "You’re approved" : "Application received"}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--color-ink-soft)]">
              {application.status === "approved"
                ? "Your seller account is live. Sign in again to reach your console."
                : `We have your application for ${application.business_name}. A member of the team reviews every one — we will contact you as soon as it has been read.`}
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
              <ButtonLink href="/shop" variant="secondary">Back to the shop</ButtonLink>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
            <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 sm:p-5">
              <h2 className="text-[18px] font-black">Apply to sell</h2>
              <p className="mt-1 text-[13px] text-[color:var(--color-ink-muted)]">
                Nothing goes live until we have approved you.
              </p>

              {!isAuthenticated ? (
                <Notice tone="info" className="mt-3">
                  You can apply without an account, but approval creates a seller login —
                  so{" "}
                  <button
                    type="button"
                    onClick={() => void requireAuth()}
                    className="font-bold underline"
                  >
                    signing in first
                  </button>{" "}
                  makes it quicker.
                </Notice>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Business name" value={form.business_name} onChange={(v) => set("business_name", v)} required placeholder="Your shop or company name" />
                <Field label="Your name" value={form.full_name} onChange={(v) => set("full_name", v)} required placeholder="Contact person" />
                <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} required inputMode="tel" placeholder="07XX XXX XXX" />
                <Field label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" placeholder="you@example.com" />

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">Business type</span>
                  <select
                    value={form.business_type}
                    onChange={(event) => set("business_type", event.target.value)}
                    className={`${FIELD} h-12`}
                  >
                    <option value="individual">Individual seller</option>
                    <option value="registered">Registered business</option>
                    <option value="company">Limited company</option>
                    <option value="importer">Importer / wholesaler</option>
                  </select>
                </label>

                <Field label="Main category" value={form.category} onChange={(v) => set("category", v)} placeholder="Electronics, fashion, home…" />
                <Field label="Region" value={form.region} onChange={(v) => set("region", v)} placeholder="Dar es Salaam" />
                <Field label="City / area" value={form.city} onChange={(v) => set("city", v)} placeholder={BRAND.city} />
                <Field label="Website or social page (optional)" value={form.website} onChange={(v) => set("website", v)} placeholder="instagram.com/yourshop" />
                <Field label="NIDA or registration number (optional)" value={form.id_number} onChange={(v) => set("id_number", v)} placeholder="Helps us verify you faster" />
              </div>

              <div className="mt-3">
                <Field
                  label="What do you want to sell?"
                  value={form.products}
                  onChange={(v) => set("products", v)}
                  multiline
                  placeholder="The kinds of products you stock, roughly how many, and where you source them."
                />
              </div>
            </section>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" loading={submitting}>
                {submitting ? "Sending application" : "Submit application"}
              </Button>
              <p className="text-[12px] text-[color:var(--color-ink-muted)]">
                Free to apply. No listing fees while you wait.
              </p>
            </div>

            <p className="text-[12px] leading-relaxed text-[color:var(--color-ink-faint)]">
              By applying you agree to {BRAND.name}’s{" "}
              <Link href="/legal/terms" className="underline">seller terms</Link> and{" "}
              <Link href="/sell/guidelines" className="underline">listing guidelines</Link>.
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
