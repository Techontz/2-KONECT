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
 * two ways *are* the hero — a pair of routes side by side, each stating what
 * it costs you and what it buys you — rather than a paragraph explaining them
 * or a carousel of campaigns.
 *
 * Side by side at every width on purpose: the pair is a comparison, and a
 * comparison stacked vertically on a phone is two separate offers.
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
      <div className="grid gap-5 p-4 sm:gap-6 sm:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:p-10">
        <div className="rise">
          <p className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/85 sm:px-3 sm:py-1.5 sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-400)]" />
            {BRAND.country} · sourcing worldwide
          </p>

          <h1 className="mt-3 text-[30px] font-black leading-[1.03] tracking-[-0.035em] text-white sm:text-[42px] lg:text-[54px]">
            Connect to what
            <br className="hidden sm:block" /> you need.
          </h1>

          {/* One line. The two cards below say the rest, and they say it in a
              form you can tap rather than one you have to read. */}
          <p className="mt-2.5 max-w-lg text-[14px] leading-snug text-white/75 sm:text-[17px] sm:leading-relaxed">
            Buy what’s already in {BRAND.country}, or order it from abroad for less.
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
        </div>

        {/* ---- the two ways to buy ---- */}
        <div className="grid gap-2.5 sm:gap-3">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <RouteCard
              href="/shop/local"
              flag="🇹🇿"
              title="In Tanzania"
              headline="Ready now"
              window="Delivered in 1–3 days"
              tradeoff="Costs a little more"
              note="Held by a seller here. Pay, and it ships."
              tone="local"
            />
            <RouteCard
              href="/shop/abroad"
              flag="🌍"
              title="From abroad"
              headline="Lower price"
              window="Arrives in 7–14 days"
              tradeoff="Worth the wait"
              note="We buy it, import it and deliver it."
              tone="import"
            />
          </div>

          {/* The sourcing desk sits under the pair rather than between the
              headline and it — it is the third answer, not an interruption. */}
          <Link
            href="/request"
            prefetch={false}
            className="group flex items-center gap-2.5 rounded-[var(--radius-md)] bg-white/10 px-3.5 py-3 transition-colors hover:bg-white/16"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              <SearchIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold text-white">
                Can’t find it? We’ll source it.
              </span>
              <span className="block truncate text-[11px] text-white/65">
                Send a photo — we find it, price it and bring it in.
              </span>
            </span>
            <ArrowIcon className="h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* One live campaign, if the team has scheduled one. */}
          {loading ? (
            <div className="skeleton hidden h-20 rounded-[var(--radius-md)] lg:block" />
          ) : banner?.image ? (
            /* The artwork carries its own headline and call to action, so
               nothing is drawn over it — a second copy of the same words in a
               gradient overlay is how a banner ends up unreadable. Desktop
               only: on a phone it would push the shelves off the screen. */
            <Link
              href={banner.link || "/deals"}
              prefetch={false}
              className="group hidden overflow-hidden rounded-[var(--radius-md)] lg:block"
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
            <div className="hidden rounded-[var(--radius-md)] bg-white/10 p-3 lg:block">
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
          <li key={item.title} className="brand-ground px-3.5 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[12px] font-bold sm:text-[13px]">{item.title}</p>
            <p className="text-[10px] text-white/65 sm:text-[11px]">{item.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One of the two ways to buy.
 *
 * States the trade-off out loud — more money for speed, or patience for a
 * lower price — because that is the actual decision, and a shopper who has
 * not been told it will assume the cheaper one is the worse one.
 */
function RouteCard({
  href,
  flag,
  title,
  headline,
  window: deliveryWindow,
  tradeoff,
  note,
  tone,
}: {
  href: string;
  flag: string;
  title: string;
  headline: string;
  window: string;
  tradeoff: string;
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
      className="group flex flex-col rounded-[var(--radius-md)] bg-white p-3 shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] sm:p-4"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="text-[17px] leading-none sm:text-[20px]">{flag}</span>
        <span className="text-[14px] font-black tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[16px]">
          {title}
        </span>
      </span>

      <span className={`mt-2 text-[15px] font-black leading-none sm:text-[17px] ${accent}`}>
        {headline}
      </span>
      <span className="mt-1 text-[12px] font-semibold text-[color:var(--color-ink-soft)] sm:text-[13px]">
        {deliveryWindow}
      </span>

      <span className="mt-1.5 text-[11px] text-[color:var(--color-ink-muted)] sm:text-[12px]">
        {tradeoff}
      </span>

      {/* The full sentence is desktop-only: on a phone the four lines above
          already answer the question and a fifth pushes the shelves down. */}
      <span className="mt-2 hidden text-[12px] leading-snug text-[color:var(--color-ink-muted)] lg:block">
        {note}
      </span>

      <span className={`mt-auto inline-flex items-center gap-1 pt-2.5 text-[12px] font-bold ${accent}`}>
        Browse
        <ArrowIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
