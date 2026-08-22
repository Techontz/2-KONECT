"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n";

/**
 * A value the shopper has to get onto their phone keypad exactly.
 *
 * Typing a till number wrong sends money to a stranger, so the number is large,
 * spaced, selectable, and one tap from the clipboard. The button confirms in
 * place rather than through a toast: the confirmation has to appear next to
 * the thing that was copied, or it answers a question nobody asked.
 */
export function CopyValue({
  label,
  value,
  display,
  tone = "default",
}: {
  label: string;
  /** What lands on the clipboard — digits only, never the formatted form. */
  value: string;
  /** What is shown, when that differs from what is copied. */
  display?: string;
  tone?: "default" | "brand";
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be refused (an insecure origin, a locked-down
      // browser). The number is on screen and selectable either way, so this
      // fails quietly rather than raising an error about a convenience.
      return;
    }

    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`rounded-[var(--radius-md)] border p-3 ${
        tone === "brand"
          ? "border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]"
          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
        {label}
      </p>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        {/* `select-all` so a shopper whose browser refuses the clipboard can
            still take it in one gesture. */}
        <span className="select-all text-[24px] font-black leading-none tracking-[0.02em] tabular-nums sm:text-[28px]">
          {display ?? value}
        </span>

        <button
          type="button"
          onClick={() => void copy()}
          aria-live="polite"
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[13px] font-bold transition-colors ${
            copied
              ? "bg-[color:var(--color-success,#137333)] text-white"
              : "border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          }`}
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          {copied ? t("payment.copied") : label}
        </button>
      </div>
    </div>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
