"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { HeroBanner as HeroBannerModel } from "@/lib/types";

/**
 * The hero: a wide rotating carousel with a fixed promotional card beside it.
 *
 * Both halves are database rows, not markup, so an administrator changes a
 * campaign by editing a banner rather than by asking for a deploy.
 *
 * The strip is deliberately shallow — a fixed 3:1 on desktop — so the first
 * product row is visible without scrolling. A hero that fills the viewport
 * pushes the actual shop below the fold.
 */
export function HeroBanner({
  slides,
  side,
  loading = false,
}: {
  slides: HeroBannerModel[];
  side: HeroBannerModel | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="skeleton aspect-[3/1] w-full rounded-[var(--radius-md)]" />
        <div className="skeleton aspect-[3/1] rounded-[var(--radius-md)] lg:aspect-auto" />
      </section>
    );
  }

  if (slides.length === 0 && !side) return null;

  return (
    // On a phone the side card drops beneath the carousel rather than being
    // squeezed into a column too narrow to read.
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
      <Carousel slides={slides} />
      {side ? <SideCard banner={side} /> : null}
    </section>
  );
}

function Carousel({ slides }: { slides: HeroBannerModel[] }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const count = slides.length;
  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    timer.current = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [count, paused]);

  // A hidden tab must not keep advancing; it wastes work and the shopper
  // returns to a slide they never saw start.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface-alt)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, position) => (
          <Slide key={slide.id} banner={slide} active={position === index} eager={position === 0} />
        ))}
      </div>

      {count > 1 ? (
        <>
          <Arrow side="left" label={t("listing.previous")} onClick={() => go(index - 1)} />
          <Arrow side="right" label={t("listing.next")} onClick={() => go(index + 1)} />

          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {slides.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(position)}
                aria-label={`${position + 1} / ${count}`}
                aria-current={position === index}
                className={`h-1.5 rounded-full transition-all ${
                  position === index
                    ? "w-5 bg-[color:var(--color-ink)]"
                    : "w-1.5 bg-[color:var(--color-ink)]/35 hover:bg-[color:var(--color-ink)]/60"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Slide({
  banner,
  active,
  eager,
}: {
  banner: HeroBannerModel;
  active: boolean;
  eager: boolean;
}) {
  const image = (
    <picture>
      {banner.mobile_image && banner.mobile_image !== banner.image ? (
        <source media="(max-width: 640px)" srcSet={banner.mobile_image} />
      ) : null}
      <img
        src={banner.image ?? ""}
        alt={banner.alt ?? banner.title ?? ""}
        // Only the first slide is above the fold; the rest wait.
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        decoding="async"
        className="aspect-[3/1] w-full object-cover"
      />
    </picture>
  );

  return (
    <div className="w-full shrink-0" aria-hidden={!active}>
      {banner.link ? (
        <Link href={banner.link} prefetch={false} tabIndex={active ? 0 : -1} className="block">
          {image}
        </Link>
      ) : (
        image
      )}
    </div>
  );
}

/** The fixed card. It never rotates — it stays until an admin changes it. */
function SideCard({ banner }: { banner: HeroBannerModel }) {
  const image = (
    <picture>
      {/* Below lg the card stacks under the carousel and spans the full width.
          The square artwork would then stand ~640px tall, so a wide crop is
          used there and the strip is pinned to the carousel's 3:1. */}
      {banner.mobile_image && banner.mobile_image !== banner.image ? (
        <source media="(max-width: 1023px)" srcSet={banner.mobile_image} />
      ) : null}
      <img
        src={banner.image ?? ""}
        alt={banner.alt ?? banner.title ?? ""}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  );

  return (
    <div className="aspect-[3/1] overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface-alt)] lg:aspect-auto">
      {banner.link ? (
        <Link href={banner.link} prefetch={false} className="block h-full">
          {image}
        </Link>
      ) : (
        image
      )}
    </div>
  );
}

function Arrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] transition-opacity hover:bg-white sm:flex ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
