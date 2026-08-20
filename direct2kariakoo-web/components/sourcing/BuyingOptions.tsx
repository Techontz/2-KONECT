"use client";

import { formatMoney } from "@/lib/format";
import type { BuyingOption } from "@/lib/types";
import { CheckIcon, ClockIcon } from "./icons";

/**
 * Buy it here, or have it brought in.
 *
 * When a product carries more than one offer this is the most valuable thing
 * on the page: the same item, priced two ways, with the trade-off stated
 * rather than implied. Cheaper is marked as cheaper and faster as faster, so
 * the shopper is choosing between two clear promises instead of decoding two
 * numbers.
 *
 * With a single offer it renders nothing — the page shows one price and the
 * availability panel says the rest.
 */
export function BuyingOptions({
  options,
  selected,
  onSelect,
  className = "",
}: {
  options: BuyingOption[];
  /** Index into `options`. */
  selected: number;
  onSelect(index: number): void;
  className?: string;
}) {
  if (options.length < 2) return null;

  const prices = options.map((option) => option.price.current);
  const cheapest = Math.min(...prices);
  const fastest = Math.min(...options.map((option) => option.sourcing.lead_time.max));

  return (
    <fieldset className={className}>
      <legend className="mb-2 text-[13px] font-extrabold text-[color:var(--color-ink)]">
        Choose how you want it
      </legend>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option, index) => {
          const active = index === selected;
          const local = option.sourcing.is_local;
          const isCheapest = option.price.current === cheapest;
          const isFastest = option.sourcing.lead_time.max === fastest;
          const saving = cheapest === option.price.current ? Math.max(...prices) - cheapest : 0;

          return (
            <button
              key={option.id ?? "primary"}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={active}
              disabled={!option.in_stock}
              className={`relative flex flex-col gap-2 rounded-[var(--radius-md)] border-2 p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${
                active
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-card)]"
                  : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-line-strong)]"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[12px] font-extrabold ${
                    local ? "text-[color:var(--color-local)]" : "text-[color:var(--color-import)]"
                  }`}
                >
                  <span aria-hidden="true">
                    {local ? option.sourcing.destination?.flag ?? "🇹🇿" : option.sourcing.origin?.flag ?? "🌍"}
                  </span>
                  {local ? "Buy in Tanzania" : "Order from abroad"}
                </span>

                <span
                  aria-hidden="true"
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                    active
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                      : "border-[color:var(--color-line-strong)]"
                  }`}
                >
                  {active ? <CheckIcon className="h-2.5 w-2.5" /> : null}
                </span>
              </span>

              {/* Stacked, not inline: two option cards side by side leave
                  roughly 170px each, and a shilling amount plus a struck one
                  on the same line wraps through the middle of the number. */}
              <span className="flex flex-col gap-0.5">
                <span className="text-[19px] font-black leading-none text-[color:var(--color-ink)]">
                  {formatMoney(option.price.current)}
                </span>
                {option.price.was ? (
                  <span className="text-[11px] leading-none text-[color:var(--color-ink-faint)] line-through">
                    {formatMoney(option.price.was)}
                  </span>
                ) : null}
              </span>

              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
                <ClockIcon className="h-3.5 w-3.5" />
                {local ? "Delivered in" : "Arrives in"} {option.sourcing.lead_time.label}
              </span>

              <span className="flex flex-wrap gap-1">
                {isCheapest && saving > 0 ? (
                  <Flag tone="save">Save {formatMoney(saving)}</Flag>
                ) : null}
                {isFastest ? <Flag tone="fast">Fastest</Flag> : null}
                {!option.in_stock ? <Flag tone="out">Out of stock</Flag> : null}
              </span>

              <span className="text-[11px] text-[color:var(--color-ink-faint)]">
                Sold by {option.seller}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Flag({ children, tone }: { children: React.ReactNode; tone: "save" | "fast" | "out" }) {
  const tones = {
    save: "bg-[color:var(--color-sale-soft)] text-[color:var(--color-sale)]",
    fast: "bg-[color:var(--color-local-soft)] text-[color:var(--color-local)]",
    out: "bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-muted)]",
  }[tone];

  return (
    <span className={`inline-flex rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[10px] font-bold ${tones}`}>
      {children}
    </span>
  );
}
