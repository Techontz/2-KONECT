"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { SiteChrome } from "@/components/layout/SiteChrome";

export interface ContentSection {
  heading: string;
  /** Paragraphs. */
  body?: string[];
  /** Bulleted points rendered under the paragraphs. */
  points?: string[];
}

/**
 * Shared layout for 2KONECT's written pages — legal, help and company.
 *
 * One component so all of them stay consistent and, more importantly, so a
 * new page is a list of translated strings rather than another hand-built
 * screen that drifts from the design system.
 */
export function ContentPage({
  title,
  intro,
  updated,
  sections,
  footnote,
}: {
  title: string;
  intro?: string;
  /** Shown as "Last updated …" when the page is a policy. */
  updated?: string;
  sections: ContentSection[];
  footnote?: React.ReactNode;
}) {
  const t = useT();

  return (
    <SiteChrome>
      <div className="shell py-4">
        <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
          <Link href="/" className="crumb hover:underline">{t("common.home")}</Link>
          <span aria-hidden="true">›</span>
          <span className="clamp-1 font-semibold text-[color:var(--color-ink)]">{title}</span>
        </nav>

        <article className="mx-auto max-w-3xl rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-5 md:p-8">
          <h1 className="text-[26px] font-black leading-tight md:text-[32px]">{title}</h1>

          {updated ? (
            <p className="mt-1 text-[12px] text-[color:var(--color-ink-faint)]">{updated}</p>
          ) : null}

          {intro ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--color-ink-muted)]">
              {intro}
            </p>
          ) : null}

          <div className="mt-6 space-y-7">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-[17px] font-extrabold">{section.heading}</h2>

                {section.body?.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-[14px] leading-relaxed">
                    {paragraph}
                  </p>
                ))}

                {section.points ? (
                  <ul className="mt-2 space-y-1.5">
                    {section.points.map((point) => (
                      <li key={point} className="flex gap-2 text-[14px] leading-relaxed">
                        <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-ink-faint)]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <footer className="mt-8 border-t border-[color:var(--color-line)] pt-5 text-[13px] text-[color:var(--color-ink-muted)]">
            {footnote ?? (
              <p>
                {BRAND.name} ·{" "}
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="break-words font-semibold text-[color:var(--color-brand)] hover:underline"
                >
                  {BRAND.supportEmail}
                </a>{" "}
                · {BRAND.supportPhone} · {BRAND.city}, {BRAND.country}
              </p>
            )}
          </footer>
        </article>
      </div>
    </SiteChrome>
  );
}
