"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, languageMeta, useLanguage } from "@/lib/i18n";

/**
 * Language control in the header.
 *
 * Deliberately compact — a flag plus the code — so it earns its place in the
 * header without displacing search or the account actions. The full language
 * names appear in the dropdown, each written in its own language.
 *
 * `tone` picks contrast for the surface it sits on: the deep utility strip on
 * a desktop, or a white bar in the footer and the mobile menu.
 */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = languageMeta(language);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.label")}
        className={`flex items-center justify-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-1 text-[12px] font-semibold ${
          tone === "dark"
            ? "text-white hover:bg-white/10"
            : "min-h-11 min-w-11 text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)] md:min-w-0 md:px-2"
        }`}
      >
        <span aria-hidden="true" className="text-[15px] leading-none">{current.flag}</span>
        <span className="hidden uppercase sm:inline">{current.code}</span>
        <ChevronIcon className="hidden h-3 w-3 shrink-0 md:block" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("language.label")}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white py-1 text-[color:var(--color-ink)] shadow-[var(--shadow-pop)]"
        >
          {LANGUAGES.map((option) => {
            const active = option.code === language;
            return (
              <li key={option.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage(option.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[color:var(--color-surface-alt)] ${
                    active ? "font-extrabold" : ""
                  }`}
                >
                  <span aria-hidden="true" className="text-[16px] leading-none">{option.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {active ? (
                    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-brand)]" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
