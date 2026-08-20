"use client";

import Link from "next/link";

import { BRAND } from "@/lib/brand";
import type { Category, HeroBanner } from "@/lib/types";
import { Skeleton } from "@/components/ui/Primitives";
import { BoxIcon, GlobeIcon, PlaneIcon, SendIcon, TruckIcon } from "@/components/sourcing/icons";

/* ==========================================================================
   The repeating blocks of the homepage, other than product rails.
   Each one returns null when it has no data, so an empty section never
   leaves a heading hanging over nothing.
   ========================================================================== */

/** Scrolling row of real categories, photographed from the live catalogue. */
export function CategoryRail({
  categories,
  loading = false,
}: {
  categories: Pick<Category, "id" | "name" | "image" | "product_count">[];
  loading?: boolean;
}) {
  if (!loading && categories.length === 0) return null;

  return (
    <section aria-label="Shop by category">
      <div className="rail gap-2.5 pb-1">
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="w-[92px] shrink-0">
                <Skeleton className="aspect-square w-full rounded-[var(--radius-md)]" />
                <Skeleton className="mt-1.5 h-3 w-full" />
              </div>
            ))
          : categories.slice(0, 14).map((category) => (
              <Link
                key={category.id}
                href={`/category?id=${category.id}`}
                prefetch={false}
                className="group w-[92px] shrink-0 text-center sm:w-[104px]"
              >
                <span className="block aspect-square overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white transition-all group-hover:border-[color:var(--color-brand-200)] group-hover:shadow-[var(--shadow-card)]">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[color:var(--color-brand-400)]">
                      <BoxIcon className="h-7 w-7" />
                    </span>
                  )}
                </span>
                <span className="clamp-2 mt-1.5 block text-[11px] font-semibold leading-tight text-[color:var(--color-ink-soft)]">
                  {category.name.trim()}
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
}

/**
 * How an imported order actually works.
 *
 * Buying something that is not in the country yet is an unfamiliar purchase,
 * and the single biggest reason not to is not knowing what happens after you
 * pay. So the answer is on the homepage rather than buried in a help page.
 */
export function HowImportsWork() {
  const steps = [
    {
      icon: <GlobeIcon className="h-5 w-5" />,
      title: "You order",
      note: "Pick the imported price and pay once. Nothing else to arrange.",
    },
    {
      icon: <SendIcon className="h-5 w-5" />,
      title: "We source it",
      note: "We buy from the supplier and hand it to the carrier.",
    },
    {
      icon: <PlaneIcon className="h-5 w-5" />,
      title: "It travels",
      note: `Air or sea to ${BRAND.country}, tracked at every step.`,
    },
    {
      icon: <TruckIcon className="h-5 w-5" />,
      title: "You choose delivery",
      note: "When it lands, have it brought to you or collect it.",
    },
  ];

  return (
    <section className="section overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-import)]">
            Ordering from abroad
          </p>
          <h2 className="mt-0.5 text-[19px] font-black tracking-[-0.02em] sm:text-[22px]">
            You pay once. We handle the rest.
          </h2>
        </div>
        <Link
          href="/shop/abroad"
          prefetch={false}
          className="tap text-[13px] font-bold text-[color:var(--color-brand)] hover:underline"
        >
          Browse imported products →
        </Link>
      </div>

      <ol className="mt-4 grid gap-px bg-[color:var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative bg-[color:var(--color-surface)] p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]">
              {step.icon}
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              Step {index + 1}
            </p>
            <p className="text-[15px] font-extrabold">{step.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
              {step.note}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The sourcing desk, pitched.
 *
 * The catalogue will never carry everything, and a shopper who cannot find
 * something is otherwise a shopper who leaves. This turns that moment into a
 * service.
 */
export function RequestBand() {
  return (
    <section className="section overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
            Sourcing service
          </p>
          <h2 className="mt-1 text-[20px] font-black tracking-[-0.02em] sm:text-[24px]">
            Can’t find what you’re looking for?
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--color-ink-soft)]">
            Send us a photo or a description and our team will find it, price it and
            bring it in. No account needed to ask.
          </p>
        </div>

        <Link
          href="/request"
          prefetch={false}
          className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-7 text-[15px] font-bold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-[color:var(--color-brand-strong)]"
        >
          Request a product
        </Link>
      </div>
    </section>
  );
}

/** The seller pitch, which closes the page once a visitor has seen the shop. */
export function SellBand() {
  return (
    <section className="section brand-ground overflow-hidden rounded-[var(--radius-md)]">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">
            For businesses
          </p>
          <h2 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-white sm:text-[24px]">
            Sell with {BRAND.name}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
            Reach buyers across {BRAND.country} on a marketplace where every seller is
            reviewed before they list. Apply once — we handle approval and verification.
          </p>
        </div>

        <Link
          href="/sell"
          prefetch={false}
          className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white px-7 text-[15px] font-bold text-[color:var(--color-brand)] transition-transform hover:-translate-y-0.5"
        >
          Apply to sell
        </Link>
      </div>
    </section>
  );
}

/** A campaign strip placed by an administrator. Renders nothing without one. */
export function PromoStrip({ banner }: { banner?: HeroBanner | null }) {
  if (!banner?.image) return null;

  return (
    <Link
      href={banner.link || "/deals"}
      prefetch={false}
      className="group block overflow-hidden rounded-[var(--radius-md)]"
    >
      {/* A phone crop when the team uploaded one, the wide artwork otherwise —
          a landscape banner scaled to 360px is unreadable. */}
      <picture>
        <source media="(min-width: 768px)" srcSet={banner.image} />
        <img
          src={banner.mobile_image || banner.image}
          alt={banner.alt || banner.title || "Offer"}
          loading="lazy"
          className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </picture>
    </Link>
  );
}
