"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { HeroBanner } from "@/lib/types";
import { Skeleton } from "@/components/ui/Primitives";

/**
 * The top of the homepage: one wide campaign, one card beside it.
 *
 * This replaces a full-width block of prose. A marketplace opens by showing
 * what there is to buy, not by explaining itself — the explanation belongs on
 * /about, and the two ways to buy are already permanent fixtures in the
 * utility strip and the category bar, so the homepage does not have to spend
 * its first screen restating them.
 *
 * Both slots are real `banners` rows. An administrator replaces the artwork
 * from the admin panel and this changes with no deploy; nothing here is
 * hard-coded, and each slot simply does not render when its row is missing.
 */
export function BannerRow({
  main,
  side,
  loading = false,
}: {
  main: HeroBanner[];
  side: HeroBanner | null;
  loading?: boolean;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = main.length;

  const go = useCallback((next: number) => {
    setIndex((current) => (count === 0 ? 0 : (next + count) % count));
  }, [count]);

  // Held in a ref so the timer below reads the current slide without having
  // to be torn down and rebuilt on every tick.
  const indexRef = useRef(index);
  indexRef.current = index;

  // Advances on its own, but stops the moment a pointer or the keyboard is on
  // it — a carousel that moves out from under a reader is a bug, not a
  // feature. Anyone who has asked their system to reduce motion keeps the
  // first slide and the controls, and nothing moves by itself.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => go(indexRef.current + 1), 6000);
    return () => window.clearInterval(timer);
  }, [count, paused, go]);

  if (loading) {
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <Skeleton className="aspect-[1200/400] w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="hidden aspect-[700/560] w-full rounded-[var(--radius-lg)] lg:block" />
      </div>
    );
  }

  if (count === 0 && !side) return null;

  const current = main[index];

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---- main campaign ---- */}
      {current ? (
        <section
          aria-roledescription="carousel"
          aria-label={t("home.featuredCampaigns")}
          className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <BannerImage banner={current} className="aspect-[1200/400] w-full" priority />

          {count > 1 ? (
            <>
              <Arrow side="left" onClick={() => go(index - 1)} />
              <Arrow side="right" onClick={() => go(index + 1)} />

              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {main.map((banner, dot) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => go(dot)}
                    aria-label={`Show campaign ${dot + 1} of ${count}`}
                    aria-current={dot === index}
                    className={`h-1.5 rounded-full transition-all ${
                      dot === index ? "w-6 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {/* ---- the card beside it ----
          Hidden below lg rather than stacked: on a phone it would push the
          category strip and the first products off the screen entirely, and
          those are what a shopper came for. */}
      {side ? (
        <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] lg:block">
          <BannerImage banner={side} className="aspect-[700/560] w-full" />
        </div>
      ) : null}
    </div>
  );
}

/** One banner, linked if it has somewhere to go. */
function BannerImage({
  banner,
  className,
  priority = false,
}: {
  banner: HeroBanner;
  className?: string;
  priority?: boolean;
}) {
  if (!banner.image) return null;

  const image = (
    <img
      src={banner.image}
      // The plate carries its own headline, so a description that repeats it
      // would be read twice. `alt` is the campaign, nothing more.
      alt={banner.alt ?? banner.title ?? ""}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`${className} object-cover transition-transform duration-500 group-hover:scale-[1.02]`}
    />
  );

  if (!banner.link) return image;

  return (
    <Link href={banner.link} prefetch={false} className="block" aria-label={banner.title ?? undefined}>
      {image}
    </Link>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick(): void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? t("home.previousCampaign") : t("home.nextCampaign")}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[color:var(--color-brand)] shadow-[var(--shadow-card)] transition-opacity hover:bg-white sm:flex ${
        side === "left" ? "left-3" : "right-3"
      } opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

export default BannerRow;
