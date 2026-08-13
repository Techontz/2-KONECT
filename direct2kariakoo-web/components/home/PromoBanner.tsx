"use client";

import Link from "next/link";
import type { HeroBanner as BannerModel } from "@/lib/types";

/**
 * A thin promotional strip placed between product rows.
 *
 * Its whole purpose is to break the page up: a homepage that is nothing but
 * product cards from top to bottom is exhausting to scan, and these give the
 * eye somewhere to rest and a way into a category.
 */
export function PromoBanner({ banner }: { banner: BannerModel | undefined }) {
  if (!banner?.image) return null;

  const image = (
    <picture>
      {banner.mobile_image && banner.mobile_image !== banner.image ? (
        <source media="(max-width: 640px)" srcSet={banner.mobile_image} />
      ) : null}
      <img
        src={banner.image}
        alt={banner.alt ?? banner.title ?? ""}
        loading="lazy"
        decoding="async"
        className="w-full object-cover"
      />
    </picture>
  );

  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface-alt)]">
      {banner.link ? (
        <Link href={banner.link} prefetch={false} className="block">
          {image}
        </Link>
      ) : (
        image
      )}
    </section>
  );
}

/**
 * Reserved advertising slot.
 *
 * Renders nothing at all until a real ad network is configured, because an
 * empty bordered box labelled "Advertisement" is worse than no slot: it is
 * dead whitespace that also implies advertising exists when it does not.
 */
export function AdSlot({ id }: { id: string }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_ADS_CLIENT);
  if (!configured) return null;

  return (
    <aside
      aria-label="Advertisement"
      data-ad-slot={id}
      className="min-h-[90px] overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface)] ring-1 ring-[color:var(--color-line)]"
    >
      {/* A real network's script fills this. Nothing is faked here. */}
    </aside>
  );
}
