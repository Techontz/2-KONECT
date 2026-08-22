"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LANGUAGES, languageMeta, useLanguage } from "@/lib/i18n";

/**
 * Language control in the header, the footer and the mobile menu.
 *
 * Deliberately compact — a flag plus the code — so it earns its place in the
 * header without displacing search or the account actions. The full language
 * names appear in the menu, each written in its own language.
 *
 * `tone` picks contrast for the surface it sits on: the deep utility strip on
 * a desktop, or a white bar in the footer and the mobile menu.
 *
 * Positioning is the part worth reading. The menu is anchored to the *button*,
 * not to whatever box the button happens to sit in — the wrapper is
 * `inline-flex` and `w-fit` so it shrink-wraps. It previously inherited the
 * width of its container, which in the footer is a whole grid column: the
 * menu's `right-0` then resolved against a 350px-wide box and the panel opened
 * a quarter of the screen away from the control that spawned it.
 *
 * It opens downward, which is what the control reads as. It only flips above
 * when there is genuinely no room below — in the footer, "below" is off the
 * bottom of the document — and it is clamped into the viewport horizontally so
 * a phone never gets a panel hanging off the edge or a page that scrolls
 * sideways.
 */
export function LanguageSwitcher({
  tone = "light",
  compact = false,
}: {
  /** Contrast for the surface it sits on. */
  tone?: "light" | "dark";
  /** Drop the touch-sized hit area. Only for the desktop utility strip, which
      is 36px tall and never seen by a thumb. */
  compact?: boolean;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ above: boolean; shift: number }>({
    above: false,
    shift: 0,
  });

  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  /* ---- where the panel goes ----
     Measured after it is in the DOM but before the browser paints, so it never
     appears in the wrong place for a frame. */
  useLayoutEffect(() => {
    if (!open) return;

    const button = buttonRef.current;
    const list = listRef.current;
    if (!button || !list) return;

    const anchor = button.getBoundingClientRect();
    const panel = list.getBoundingClientRect();
    const margin = 8;

    const roomBelow = window.innerHeight - anchor.bottom;
    const roomAbove = anchor.top;
    // Downward is the default and stays the default. Flipping only happens
    // when the panel would be cut off *and* there is more room the other way.
    const above = roomBelow < panel.height + margin && roomAbove > roomBelow;

    // The panel is right-aligned to the button; work out how far it must slide
    // to stay on screen, then apply that as a shift rather than re-anchoring.
    const right = anchor.right;
    const left = right - panel.width;
    let shift = 0;
    if (left < margin) shift = margin - left;
    else if (right > window.innerWidth - margin) shift = window.innerWidth - margin - right;

    setPlacement({ above, shift });
  }, [open]);

  /* ---- dismissal ---- */
  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    // A menu pinned to a button has to close when that button moves, or it is
    // left floating over the page.
    const onReflow = () => setOpen(false);

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, close]);

  /* ---- keyboard ----
     Arrow keys walk the options, Home/End jump to the ends. */
  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-language]") ?? [],
    );
    if (!items.length) return;

    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;

    items[next]?.focus();
  }

  function openWith(focus: "first" | "selected") {
    setOpen(true);
    // Focus lands after the panel exists.
    window.requestAnimationFrame(() => {
      const items = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-language]") ?? [],
      );
      const target =
        focus === "selected"
          ? items.find((item) => item.dataset.language === language) ?? items[0]
          : items[0];
      target?.focus();
    });
  }

  const current = languageMeta(language);

  return (
    <div ref={ref} className="relative inline-flex w-fit">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openWith("selected");
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("language.label")}: ${current.label}`}
        className={`flex items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 ${
          compact ? "" : "min-h-11 min-w-11"
        } ${
          tone === "dark"
            ? "text-white hover:bg-white/10 focus-visible:ring-white/70"
            : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)] focus-visible:ring-[color:var(--color-brand)]"
        }`}
      >
        {/* The code is always shown. A lone flag is a guess — and on a phone
            the footer control was rendering as nothing but one. */}
        <span aria-hidden="true" className="text-[15px] leading-none">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <ChevronIcon
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t("language.label")}
          onKeyDown={onListKeyDown}
          style={{ transform: placement.shift ? `translateX(${placement.shift}px)` : undefined }}
          className={`fade-in absolute right-0 z-[90] w-[184px] overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-white py-1 text-[color:var(--color-ink)] shadow-[var(--shadow-pop)] ${
            placement.above ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          }`}
        >
          {LANGUAGES.map((option) => {
            const active = option.code === language;
            return (
              <li key={option.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  data-language={option.code}
                  onClick={() => {
                    setLanguage(option.code);
                    close();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] outline-none transition-colors hover:bg-[color:var(--color-surface-alt)] focus-visible:bg-[color:var(--color-surface-alt)] ${
                    active ? "font-extrabold text-[color:var(--color-brand)]" : ""
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
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
