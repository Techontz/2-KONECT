"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Banner } from "@/lib/types";

/**
 * Full-width hero carousel — the first thing below the navigation on the
 * reference homepage.
 *
 * Slides are the real banners managed in the admin. Auto-advance pauses on
 * hover and whenever the tab is hidden, so a background tab does not spin.
 */
export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const count = banners.length;

  useEffect(() => {
    if (count <= 1 || paused) return;

    timer.current = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 5500);

    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [count, paused]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0) {
    return (
      <div className="aspect-[1400/380] w-full overflow-hidden rounded-[var(--radius-md)]">
        <div className="skeleton h-full w-full" />
      </div>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured promotions"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, slideIndex) => {
          const image = (
            <img
              src={banner.image ?? ""}
              alt={banner.alt ?? banner.title ?? "Promotion"}
              // The first slide is the page's largest contentful paint, so it
              // loads eagerly; the rest wait.
              loading={slideIndex === 0 ? "eager" : "lazy"}
              fetchPriority={slideIndex === 0 ? "high" : "auto"}
              decoding="async"
              className="aspect-[1400/380] w-full object-cover"
            />
          );

          return (
            <div key={banner.id} className="w-full shrink-0" aria-hidden={slideIndex !== index}>
              {banner.link ? (
                <Link href={banner.link} prefetch={false}>{image}</Link>
              ) : (
                image
              )}
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <CarouselArrow side="left" onClick={() => setIndex((i) => (i - 1 + count) % count)} />
          <CarouselArrow side="right" onClick={() => setIndex((i) => (i + 1) % count)} />

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, dotIndex) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Go to slide ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                className={`h-1.5 rounded-full transition-all ${
                  dotIndex === index ? "w-6 bg-[color:var(--color-ink)]" : "w-1.5 bg-black/30"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] transition-transform hover:scale-105 md:flex ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}

export default HeroCarousel;
