"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { usePageContent, useT } from "@/lib/i18n";
import { SiteChrome } from "@/components/layout/SiteChrome";

/**
 * Help centre.
 *
 * A hub rather than a wall of text: each card is a real destination, so a
 * visitor either lands on the answer or on a way to reach a person.
 */
export default function HelpPage() {
  const copy = usePageContent("help");
  const t = useT();

  return (
    <SiteChrome>
      <div className="shell py-4">
        <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
          <Link href="/" className="crumb hover:underline">{t("common.home")}</Link>
          <span aria-hidden="true">›</span>
          <span className="font-semibold text-[color:var(--color-ink)]">{copy.title}</span>
        </nav>

        <header className="mb-5 overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-brand)] p-6 md:p-8">
          <h1 className="text-[26px] font-black leading-tight md:text-[32px]">{copy.title}</h1>
          {copy.intro ? <p className="mt-2 max-w-xl text-[14px] opacity-80">{copy.intro}</p> : null}
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {copy.topics?.map((topic) => (
            <Link
              key={topic.href + topic.name}
              href={topic.href}
              prefetch={false}
              className="group rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4 ring-1 ring-[color:var(--color-line)] transition-shadow hover:shadow-[var(--shadow-hover)]"
            >
              <p className="flex items-center gap-2 text-[15px] font-extrabold">
                {topic.name}
                <span
                  aria-hidden="true"
                  className="text-[color:var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5"
                >
                  ›
                </span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink-muted)]">
                {topic.description}
              </p>
            </Link>
          ))}
        </div>

        <section className="mt-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-5">
          <h2 className="text-[15px] font-extrabold">{BRAND.name}</h2>
          {/* These two are the point of the card — the way you actually reach
              support — so on a phone each is a full-height row rather than a
              line of 18px text. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-4 text-[13px] text-[color:var(--color-ink-muted)] sm:mt-2 sm:gap-y-1">
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="block break-words py-3 font-semibold text-[color:var(--color-action)] hover:underline sm:py-0"
            >
              {BRAND.supportEmail}
            </a>
            <a
              href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}
              className="block py-3 font-semibold text-[color:var(--color-action)] hover:underline sm:py-0"
            >
              {BRAND.supportPhone}
            </a>
            <span>{BRAND.city}, {BRAND.country}</span>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
