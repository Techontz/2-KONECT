"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
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
  const params = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [name, setName] = useState(params.get("name") ?? "");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
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
      setError(apiError(err, "We couldn’t send that request. Please check the details and try again."));
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

          <h1 className="mt-4 text-[24px] font-black tracking-[-0.025em]">Request received</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--color-ink-soft)]">
            {BRAND.name} has your request for <span className="font-bold">{done.name}</span>.
            Our sourcing team will look for it and come back to you with a price and an
            arrival date.
          </p>

          <p className="mt-4 inline-flex flex-col items-center rounded-[var(--radius-md)] bg-[color:var(--color-brand-50)] px-5 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
              Your reference
            </span>
            <span className="text-[20px] font-black tracking-wide">{done.reference}</span>
          </p>

          <ol className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
            {[
              "We review what you sent and check we understand it.",
              "We find a supplier and confirm the real cost.",
              "We send you a price and an arrival date to approve.",
              "You confirm, we order it, and you track it like any order.",
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
              <ButtonLink href="/account/requests" size="lg">Track this request</ButtonLink>
            ) : (
              <p className="text-[13px] text-[color:var(--color-ink-muted)]">
                We will call you on <span className="font-bold">{phone}</span>. Create an
                account to follow it online.
              </p>
            )}
            <ButtonLink href="/shop" size="lg" variant="secondary">Keep shopping</ButtonLink>
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
            Sourcing service
          </p>
          <h1 className="mt-1 max-w-2xl text-[28px] font-black leading-tight tracking-[-0.025em] text-white sm:text-[38px]">
            Tell us what you need. We’ll find it.
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-snug text-white/75 sm:text-[15px] sm:leading-relaxed">
            Send a photo or a description. We source it, price it and bring it into{" "}
            {BRAND.country}.
          </p>

          {/* Three short reassurances, wrapped rather than stacked: on a phone
              three full-width rows of one sentence each push the form itself
              off the screen, and the form is the point of the page. */}
          <ul className="mt-4 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
            {[
              { icon: <SendIcon className="h-3.5 w-3.5" />, text: "No account needed" },
              { icon: <GlobeIcon className="h-3.5 w-3.5" />, text: "Sourced from anywhere" },
              { icon: <ShieldIcon className="h-3.5 w-3.5" />, text: "You approve the price" },
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
            <h2 className="text-[16px] font-black">What are you looking for?</h2>

            {/* The photo comes first: for most requests it is the clearest
                description there is, and it is the least work to provide. */}
            <div className="mt-3">
              <span className="mb-1.5 block text-[13px] font-bold">Photo (optional)</span>

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
                      Remove photo
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
                  <span className="text-[14px] font-bold">Upload a photo</span>
                  <span className="text-[12px] text-[color:var(--color-ink-muted)]">
                    A screenshot or a picture works — up to 5MB
                  </span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                className="sr-only"
                aria-label="Product photo"
              />
            </div>

            <div className="mt-4 space-y-3">
              <TextField
                label="What is it?"
                value={name}
                onChange={setName}
                required
                placeholder="iPhone 15 Pro 256GB, Natural Titanium"
              />
              <TextField
                label="Describe what you need"
                value={description}
                onChange={setDescription}
                multiline
                placeholder="Colour, size, model, condition — anything that matters to you."
              />

              {/* Brand takes the row; the two short numeric fields share the
                  next one even on the narrowest phone — stacking three
                  full-width inputs here is what made this form feel endless. */}
              <TextField label="Brand (optional)" value={brand} onChange={setBrand} placeholder="Apple" />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">Quantity</span>
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
                  <span className="mb-1.5 block text-[13px] font-bold">Budget (optional)</span>
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
            <h2 className="text-[16px] font-black">How do we reach you?</h2>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-muted)]">
              We come back with a price and an arrival date before anything is ordered.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Your name" value={contactName} onChange={setContactName} required placeholder="Full name" />
              <TextField label="Phone" value={phone} onChange={setPhone} required inputMode="tel" placeholder="07XX XXX XXX" />
              <TextField label="Email (optional)" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
              <TextField label="Deliver to" value={city} onChange={setCity} placeholder={BRAND.city} />
            </div>
          </section>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" loading={submitting}>
              {submitting ? "Sending request" : "Submit request"}
            </Button>
            <p className="text-[12px] text-[color:var(--color-ink-muted)]">
              No payment now. Nothing is ordered until you approve the price.
            </p>
          </div>

          <p className="text-[12px] text-[color:var(--color-ink-faint)]">
            Already sent one?{" "}
            <Link href="/account/requests" className="font-bold text-[color:var(--color-brand)] hover:underline">
              Check your requests
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
