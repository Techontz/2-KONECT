"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BRAND } from "@/lib/brand";
import type { Category, HeroBanner as HeroBannerModel } from "@/lib/types";

/**
 * The homepage hero.
 *
 * It has one job: make a first-time visitor understand, in about three
 * seconds, that this marketplace sells the same catalogue two ways. So the
 * two ways are the hero — a pair of routes you can tap, with their real
 * trade-offs written on them — rather than a rotating carousel of campaigns.
 *
 * Campaign artwork still runs, in the panel beside it and in the strips
 * further down the page, where it competes with nothing.
 */
export function Hero({
  categories = [],
  banner,
  loading = false,
}: {
  categories?: Pick<Category, "id" | "name" | "image" | "product_count">[];
  banner?: HeroBannerModel | null;
  loading?: boolean;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");

  function search(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/shop");
  }

  return (
    <section className="brand-ground overflow-hidden rounded-[var(--radius-lg)]">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:p-10">
        <div className="rise">
          <p className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-white/12 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-400)]" />
            {BRAND.country} · sourcing worldwide
          </p>

          <h1 className="mt-3.5 text-[28px] font-black leading-[1.06] tracking-[-0.03em] text-white sm:text-[40px] lg:text-[52px]">
            Connect to what
            <br className="hidden sm:block" /> you need.
          </h1>

          <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed text-white/80 sm:text-[16px]">
            Buy what is already here in {BRAND.country} and have it in days — or order it
            from abroad for less and follow it the whole way home.
          </p>

          {/* Desktop only. On a phone the header already carries a full-width
              search field one thumb-length above this one, and two identical
              fields on one screen is not a bigger target — it is a confusing
              one. */}
          <form onSubmit={search} role="search" className="mt-5 hidden max-w-lg sm:block">
            <div className="flex h-[52px] items-center gap-2 rounded-[var(--radius-pill)] bg-white pl-4 pr-1.5 shadow-[var(--shadow-pop)]">
              <SearchIcon className="h-5 w-5 shrink-0 text-[color:var(--color-ink-muted)]" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="What are you looking for?"
                aria-label="Search products"
                className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-[color:var(--color-ink-faint)]"
              />
              <button
                type="submit"
                className="flex h-10 shrink-0 items-center rounded-[var(--radius-pill)] bg-[color:var(--color-brand)] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[color:var(--color-brand-strong)]"
              >
                Search
              </button>
            </div>
          </form>

          <p className="mt-4 text-[13px] text-white/65 sm:mt-3">
            Can’t find it?{" "}
            <Link href="/request" prefetch={false} className="font-bold text-white underline underline-offset-4">
              Ask us to source it
            </Link>
          </p>
        </div>

        {/* ---- the two ways to buy ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <RouteCard
            href="/shop/local"
            flag="🇹🇿"
            title="Available in Tanzania"
            price="Ready now"
            detail="Delivered in 1–3 days"
            note="In stock locally. Pay, and it ships."
            tone="local"
          />
          <RouteCard
            href="/shop/abroad"
            flag="🌍"
            title="Order from abroad"
            price="Lower price"
            detail="Arrives in 7–14 days"
            note="We buy it, import it, deliver it."
            tone="import"
          />

          {/* One live campaign, if the team has scheduled one. */}
          {loading ? (
            <div className="skeleton h-24 rounded-[var(--radius-md)] sm:col-span-2" />
          ) : banner?.image ? (
            /* The artwork carries its own headline and call to action, so
               nothing is drawn over it — a second copy of the same words in a
               gradient overlay is how a banner ends up unreadable. The aspect
               ratio is the artwork's own, so it is never cropped through the
               middle of its type. */
            <Link
              href={banner.link || "/deals"}
              prefetch={false}
              className="group block overflow-hidden rounded-[var(--radius-md)] sm:col-span-2"
            >
              <img
                src={banner.image}
                alt={banner.alt || banner.title || "Featured offer"}
                loading="lazy"
                className="aspect-[3/1] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </Link>
          ) : (
            /* No campaign scheduled — the space becomes the top categories
               rather than an empty box. */
            <div className="rounded-[var(--radius-md)] bg-white/10 p-3 sm:col-span-2">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
                Popular right now
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.slice(0, 6).map((category) => (
                  <Link
                    key={category.id}
                    href={`/category?id=${category.id}`}
                    prefetch={false}
                    className="rounded-[var(--radius-pill)] bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-white/90 transition-colors hover:bg-white/20"
                  >
                    {category.name.trim()}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- what the platform promises, in four facts ---- */}
      <ul className="grid grid-cols-2 gap-px border-t border-white/12 bg-white/10 text-white lg:grid-cols-4">
        {[
          { title: "Two ways to buy", note: "Local stock or imported" },
          { title: "Tracked end to end", note: "Every step, every day" },
          { title: "Verified sellers", note: "Checked before they list" },
          { title: "Sourcing on request", note: "We find what isn’t listed" },
        ].map((item) => (
          <li key={item.title} className="brand-ground px-4 py-3">
            <p className="text-[13px] font-bold">{item.title}</p>
            <p className="text-[11px] text-white/65">{item.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RouteCard({
  href,
  flag,
  title,
  price,
  detail,
  note,
  tone,
}: {
  href: string;
  flag: string;
  title: string;
  price: string;
  detail: string;
  note: string;
  tone: "local" | "import";
}) {
  const accent =
    tone === "local"
      ? "text-[color:var(--color-local)]"
      : "text-[color:var(--color-import)]";

  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex flex-col gap-1 rounded-[var(--radius-md)] bg-white p-4 shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <span aria-hidden="true" className="text-[22px] leading-none">{flag}</span>
      <span className="mt-1 text-[15px] font-black tracking-[-0.02em] text-[color:var(--color-ink)]">
        {title}
      </span>
      <span className={`text-[12px] font-bold ${accent}`}>{price} · {detail}</span>
      <span className="mt-1 text-[12px] leading-snug text-[color:var(--color-ink-muted)]">{note}</span>
      <span className={`mt-2 inline-flex items-center gap-1 text-[12px] font-bold ${accent}`}>
        Browse
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
