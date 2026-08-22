"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import { compactAmount, formatMoney, groupDigits } from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * The maximum-price control.
 *
 * Three ways into one number. A ladder of round caps for the common case, a
 * typed amount for the shopper who has an exact budget, and the slider for
 * sweeping through the range. They are three views of a single value, not
 * three filters: moving any one of them moves the other two.
 *
 * It replaced a lone slider, which on a catalogue spanning a few thousand
 * shillings to a few million made every useful cap a pixel wide.
 *
 * The ladder is derived from the catalogue, not written down here. A ladder
 * fixed in code puts "Under 5M" on a page where the dearest thing costs 90,000
 * — seven chips that all mean "everything". `priceLadder` walks a 1 / 2.5 / 5
 * progression and keeps the rungs that actually divide *this* result set.
 */

/** Round caps below `max`, coarsest last. */
export function priceLadder(max: number, rungs = 6): number[] {
  if (!Number.isFinite(max) || max <= 0) return [];

  const steps: number[] = [];
  for (let exponent = 2; exponent <= 12; exponent++) {
    for (const mantissa of [1, 2.5, 5]) {
      const value = mantissa * 10 ** exponent;
      // A cap at or above the dearest product selects everything, so it is not
      // a filter — it is the absence of one, and the ladder leaves it out.
      if (value < max) steps.push(value);
    }
  }

  return steps.slice(-rungs);
}

export function PriceFilter({
  min,
  max,
  value,
  onChange,
}: {
  /** Cheapest product in the current result set. */
  min: number;
  /** Dearest product in the current result set. */
  max: number;
  value: number | undefined;
  onChange(value: number | undefined): void;
}) {
  const t = useT();

  const ladder = useMemo(() => priceLadder(max), [max]);

  // `custom` is sticky: once the shopper opens the field it stays open, so the
  // amount they typed does not vanish underneath them when it happens to
  // coincide with a rung.
  const [custom, setCustom] = useState(() => value !== undefined && !ladder.includes(value));
  const [text, setText] = useState(() => (value === undefined ? "" : groupDigits(String(value))));

  // The slider and the chips report continuously; the request should not.
  const timer = useRef<number | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function commit(next: number | undefined, immediate = false) {
    if (timer.current) window.clearTimeout(timer.current);
    if (immediate) {
      latest.current(next);
      return;
    }
    timer.current = window.setTimeout(() => latest.current(next), 300);
  }

  /** A cap at or above the ceiling is no cap at all, and neither is zero. */
  function normalise(amount: number | undefined): number | undefined {
    if (amount === undefined || !Number.isFinite(amount) || amount <= 0) return undefined;
    return amount >= max ? undefined : Math.round(amount);
  }

  function apply(next: number | undefined, immediate = false) {
    const capped = normalise(next);
    setText(capped === undefined ? "" : groupDigits(String(capped)));
    commit(capped, immediate);
  }

  // Follow the value when it is changed from outside — "Clear all filters", or
  // a fresh result set whose ceiling no longer contains the old cap.
  useEffect(() => {
    setText(value === undefined ? "" : groupDigits(String(value)));
    if (value !== undefined && !ladder.includes(value)) setCustom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const typed = Number(text.replace(/\D/g, ""));
  const tooHigh = text !== "" && typed >= max;
  const belowFloor = text !== "" && typed > 0 && typed < min;

  // Step 1 so the track can land on *any* amount. A coarser step would snap a
  // typed 1,500,000 to the nearest rung it happened to support — the slider
  // would then disagree with the field above it, which is the one thing these
  // three controls must never do. The practical granularity is unchanged: the
  // track is a couple of hundred pixels wide either way.
  const sliderStep = 1;
  const inputId = "price-filter-max";

  return (
    <div className="space-y-2.5">
      {/* ---- the ladder ---- */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filters.quickPrice")}>
        <PriceChip
          active={value === undefined && !custom}
          label={t("filters.anyShort")}
          title={t("filters.anyPrice")}
          onClick={() => { setCustom(false); apply(undefined, true); }}
        />

        {ladder.map((amount) => (
          <PriceChip
            key={amount}
            active={!custom && value === amount}
            label={compactAmount(amount)}
            title={t("filters.under", { amount: formatMoney(amount) })}
            onClick={() => { setCustom(false); apply(amount, true); }}
          />
        ))}

        <PriceChip
          active={custom}
          label={t("filters.custom")}
          onClick={() => setCustom(true)}
        />
      </div>

      {/* ---- the exact amount ----
          Shown once the shopper asks for it, or whenever the cap in force is
          not one of the rungs — otherwise the number on screen would have no
          control that explains it. */}
      {custom ? (
        <div>
          <label htmlFor={inputId} className="mb-1 block text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
            {t("filters.maximumPrice")}
          </label>
          <div className="flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-2.5 focus-within:border-[color:var(--color-brand)] focus-within:ring-2 focus-within:ring-[color:var(--color-brand-100,rgba(27,44,62,0.15))]">
            <span aria-hidden="true" className="shrink-0 text-[12px] font-bold text-[color:var(--color-ink-faint)]">
              {BRAND.currency}
            </span>
            <input
              id={inputId}
              // `text` with a numeric keypad rather than `type="number"`: the
              // value carries thousands separators as it is typed, which a
              // number input rejects outright, and it never shows spinners
              // that step by 1 through millions.
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={text}
              onChange={(event) => {
                // Non-digits never reach state, so letters, minus signs and
                // decimals cannot be entered rather than being reported as
                // errors after the fact.
                const grouped = groupDigits(event.target.value);
                setText(grouped);
                commit(normalise(Number(grouped.replace(/\D/g, "")) || undefined));
              }}
              onBlur={() => apply(typed || undefined, true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  apply(typed || undefined, true);
                }
              }}
              placeholder={groupDigits(String(Math.round(max)))}
              aria-describedby={tooHigh || belowFloor ? `${inputId}-hint` : undefined}
              className="h-full w-full min-w-0 bg-transparent text-[13px] font-bold tabular-nums outline-none placeholder:font-normal placeholder:text-[color:var(--color-ink-faint)]"
            />
            {text ? (
              <button
                type="button"
                onClick={() => apply(undefined, true)}
                aria-label={t("filters.clearPrice")}
                className="shrink-0 px-0.5 text-[color:var(--color-ink-faint)] hover:text-[color:var(--color-ink)]"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Not an error — the input is never in an invalid state. It is the
              one thing the shopper cannot see: what their number means against
              a catalogue whose range they do not know. */}
          {tooHigh || belowFloor ? (
            <p id={`${inputId}-hint`} role="status" className="mt-1 text-[11px] text-[color:var(--color-ink-muted)]">
              {tooHigh
                ? t("filters.priceAboveAll", { amount: formatMoney(max) })
                : t("filters.priceBelowAll", { amount: formatMoney(min) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ---- the sweep ---- */}
      <div>
        <input
          type="range"
          min={min}
          max={max}
          step={sliderStep}
          value={value ?? max}
          onChange={(event) => {
            const next = Number(event.target.value);
            setCustom(false);
            apply(next);
          }}
          aria-label={t("filters.maximumPrice")}
          aria-valuetext={value === undefined ? t("filters.anyPrice") : formatMoney(value)}
          className="w-full accent-[color:var(--color-brand)]"
        />
        <p className="text-[12px] font-semibold" aria-live="polite">
          {value === undefined
            ? t("filters.anyPrice")
            : t("filters.upTo", { amount: formatMoney(value) })}
        </p>
      </div>
    </div>
  );
}

function PriceChip({
  active,
  label,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  title?: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={title}
      className={`inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] border px-3 text-[12px] font-bold tabular-nums transition-colors ${
        active
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]"
          : "border-[color:var(--color-line-strong)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]"
      }`}
    >
      {label}
    </button>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
