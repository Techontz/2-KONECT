"use client";

import { useCurrency } from "@/lib/store/currency";
import type { CurrencyCode } from "@/lib/currency";

/**
 * TZS / USD, in the header.
 *
 * A segmented pair rather than a dropdown. There are exactly two currencies,
 * both are always available, and the active one should be readable at a glance
 * without opening anything — a select for two options costs a click to show
 * the shopper what they could already have seen.
 *
 * Renders nothing until the provider has settled. The first paint is always
 * the default currency (localStorage does not exist on the server), so showing
 * the control before then would flash TZS at somebody who chose USD.
 */
export function CurrencySwitcher({
  className = "",
  tone = "light",
}: {
  className?: string;
  /** Contrast for the surface it sits on — the header's utility strip is dark. */
  tone?: "light" | "dark";
}) {
  const { currency, ready, setCurrency, options } = useCurrency();

  if (!ready) {
    // A reserved box, not a spinner: the header must not jump when this
    // resolves a moment later.
    return <span className={`inline-block h-7 w-[86px] ${className}`} aria-hidden />;
  }

  return (
    <span
      role="group"
      aria-label="Display currency"
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${
        tone === "dark"
          ? "bg-white/10 ring-1 ring-white/15"
          : "bg-[color:var(--color-brand-50)] ring-1 ring-[color:var(--color-line)]"
      } ${className}`}
    >
      {options.map((option) => {
        const active = option.code === currency;

        return (
          <button
            key={option.code}
            type="button"
            onClick={() => setCurrency(option.code as CurrencyCode)}
            aria-pressed={active}
            title={`Show prices in ${option.label}`}
            className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black leading-none transition ${
              active
                ? tone === "dark"
                  ? "bg-white text-[color:var(--color-brand)]"
                  : "bg-[color:var(--color-brand)] text-white shadow-sm"
                : tone === "dark"
                  ? "text-white/75 hover:text-white"
                  : "text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-brand)]"
            }`}
          >
            <span aria-hidden>{option.flag}</span>
            <span>{option.short}</span>
          </button>
        );
      })}
    </span>
  );
}

export default CurrencySwitcher;
