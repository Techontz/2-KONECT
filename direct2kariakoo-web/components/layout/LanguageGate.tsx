"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { DEFAULT_LANGUAGE, LANGUAGES, useLanguage, type LanguageCode } from "@/lib/i18n";

/**
 * The first thing a new visitor sees.
 *
 * Shown once, on the first visit only — after a choice is stored the gate
 * never renders again, so returning shoppers go straight to the storefront.
 * Kiswahili is preselected because it is the language of this marketplace's
 * customers; the other three are one tap away rather than hidden in a menu.
 */
export function LanguageGate() {
  const { needsChoice, ready, setLanguage } = useLanguage();
  const [choice, setChoice] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  const open = ready && needsChoice;

  // The page behind must not scroll while the gate owns the screen.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-gate-title"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface)] shadow-[var(--shadow-hover)] sm:rounded-[var(--radius-lg)]">
        <div className="bg-[color:var(--color-brand)] px-6 py-5 text-center">
          <p className="text-[19px] font-black tracking-tight text-[color:var(--color-brand-ink)]">
            {BRAND.wordmark.lead}
            <span className="opacity-70">{BRAND.wordmark.tail}</span>
          </p>
        </div>

        <div className="px-5 pb-5 pt-4">
          {/* Deliberately not translated: the visitor has not chosen a
              language yet, so each option speaks for itself instead. */}
          <h2 id="language-gate-title" className="text-center text-[18px] font-black">
            Choose your language
          </h2>
          <p className="mt-1 text-center text-[12px] text-[color:var(--color-ink-muted)]">
            Chagua lugha yako · Choisissez votre langue · 选择您的语言
          </p>

          <div className="mt-4 space-y-2">
            {LANGUAGES.map((language) => {
              const selected = choice === language.code;
              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => setChoice(language.code)}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-left transition-all ${
                    selected
                      ? "bg-[color:var(--color-action-soft)] ring-2 ring-[color:var(--color-action)]"
                      : "ring-1 ring-[color:var(--color-line)] hover:ring-[color:var(--color-line-strong)]"
                  }`}
                >
                  <span aria-hidden="true" className="text-[22px] leading-none">
                    {language.flag}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold">{language.label}</span>
                    {language.code === DEFAULT_LANGUAGE ? (
                      <span className="block text-[11px] font-semibold text-[color:var(--color-success)]">
                        Inapendekezwa · Recommended
                      </span>
                    ) : null}
                  </span>

                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected
                        ? "border-[color:var(--color-action)] bg-[color:var(--color-action)] text-white"
                        : "border-[color:var(--color-line-strong)]"
                    }`}
                  >
                    {selected ? <CheckIcon className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setLanguage(choice)}
            className="mt-4 h-12 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-action)] text-[15px] font-bold text-white transition-colors hover:bg-[color:var(--color-action-dark)]"
          >
            Continue · Endelea
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
