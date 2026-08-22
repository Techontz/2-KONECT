"use client";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/store/auth";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Button } from "@/components/ui/Primitives";
import { BoxIcon, GlobeIcon, PlaneIcon, TruckIcon } from "@/components/sourcing/icons";

/**
 * Track an order.
 *
 * A reference is not a password, so this does not try to be a public lookup:
 * it takes the number, makes sure the visitor is signed in as the account that
 * placed it, and hands them to the order page — where the real timeline lives.
 * One tracking screen, not two that can disagree.
 */
export default function TrackPage() {
  const t = useT();
  const router = useRouter();
  const { isAuthenticated, requireAuth } = useAuth();
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!value) return;

    setBusy(true);

    // Order history belongs to an account; ask for it before navigating so the
    // shopper is not bounced to a sign-in screen mid-journey.
    if (!isAuthenticated && !(await requireAuth())) {
      setBusy(false);
      return;
    }

    router.push(`/account/orders/${encodeURIComponent(value)}`);
  }

  return (
    <SiteChrome>
      <section className="brand-ground">
        <div className="shell py-10 sm:py-14">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            {t("track.eyebrow")}
          </p>
          <h1 className="mt-1 max-w-2xl text-[28px] font-black leading-tight tracking-[-0.025em] text-white sm:text-[38px]">
            {t("track.title")}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-white/75 sm:text-[15px]">
            {t("track.introBefore")} <span className="font-bold text-white">2K-A1B2C3D4</span>.{" "}
            {t("track.introAfter")}
          </p>

          <form onSubmit={submit} className="mt-6 flex max-w-lg flex-col gap-2 sm:flex-row">
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="2K-XXXXXXXX"
              aria-label={t("track.referenceLabel")}
              autoComplete="off"
              className="h-[52px] w-full rounded-[var(--radius-sm)] bg-white px-4 text-[15px] font-bold uppercase tracking-wide outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[color:var(--color-ink-faint)]"
            />
            <Button type="submit" size="lg" variant="secondary" loading={busy} className="shrink-0">
              {t("track.trackButton")}
            </Button>
          </form>
        </div>
      </section>

      <div className="shell py-8 pb-tabbar">
        <h2 className="text-[18px] font-black tracking-[-0.02em] sm:text-[22px]">
          {t("track.stagesTitle")}
        </h2>
        <p className="mt-1 text-[14px] text-[color:var(--color-ink-muted)]">
          {t("track.stagesHint")}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <BoxIcon className="h-5 w-5" />,
              title: t("track.confirmed"),
              note: t("track.confirmedNote"),
            },
            {
              icon: <GlobeIcon className="h-5 w-5" />,
              title: t("track.dispatched"),
              note: t("track.dispatchedNote"),
            },
            {
              icon: <PlaneIcon className="h-5 w-5" />,
              title: t("track.inTransit"),
              note: t("track.inTransitNote", { country: BRAND.country }),
            },
            {
              icon: <TruckIcon className="h-5 w-5" />,
              title: t("track.outForDelivery"),
              note: t("track.outForDeliveryNote", { brand: BRAND.name }),
            },
          ].map((stage) => (
            <article
              key={stage.title}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]">
                {stage.icon}
              </span>
              <h3 className="mt-3 text-[15px] font-extrabold">{stage.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
                {stage.note}
              </p>
            </article>
          ))}
        </div>
      </div>
    </SiteChrome>
  );
}
