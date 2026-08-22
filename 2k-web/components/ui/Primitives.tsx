"use client";

import Link from "next/link";

import { formatAmount, formatMoney } from "@/lib/format";
import type { Price, Rating } from "@/lib/types";

/* ==========================================================================
   Small shared primitives.

   Each one exists because the storefront reuses the same visual element
   across cards, listings, the product page and checkout — defining them once
   is what keeps every surface consistent. Variants are props, never copies.
   ========================================================================== */

/**
 * Price block: current price, struck original, discount percentage.
 *
 * Shilling amounts run long, so the struck price and the discount sit on a
 * second line rather than being squeezed onto one and truncated.
 */
export function PriceBlock({
  price,
  size = "md",
}: {
  price: Price;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const current = {
    sm: "text-[13px]",
    md: "text-[16px]",
    lg: "text-[22px]",
    xl: "text-[30px]",
  }[size];

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`${current} font-black leading-tight tracking-[-0.02em] text-[color:var(--color-ink)]`}>
        {formatMoney(price.current)}
      </span>

      {price.was !== null && price.discount_percent ? (
        <span className="flex flex-wrap items-center gap-1.5 text-[11px] leading-tight">
          <span className="text-[color:var(--color-ink-faint)] line-through">
            {formatAmount(price.was)}
          </span>
          <span className="rounded-[var(--radius-xs)] bg-[color:var(--color-sale-soft)] px-1.5 py-[1px] font-bold text-[color:var(--color-sale)]">
            −{price.discount_percent}%
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** Compact star rating, as it appears under a product title. */
export function RatingPill({ rating }: { rating: Rating }) {
  if (!rating.count) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-ink-muted)]">
      <span className="inline-flex items-center gap-0.5 rounded-[var(--radius-xs)] bg-[color:var(--color-warn-soft)] px-1.5 py-0.5 font-bold text-[color:var(--color-warn)]">
        {rating.average.toFixed(1)}
        <StarIcon className="h-3 w-3" />
      </span>
      <span>({rating.count})</span>
    </span>
  );
}

export function StarIcon({ className = "h-4 w-4", filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.6}>
      <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.9L12 2.5z" />
    </svg>
  );
}

/** Full five-star row for the reviews summary. */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[color:var(--color-warn)]">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={`${className} ${star <= Math.round(value) ? "" : "text-[color:var(--color-line-strong)]"}`}
        />
      ))}
    </span>
  );
}

type ToneName = "brand" | "sale" | "local" | "import" | "success" | "warn" | "neutral" | "dark";

const TONES: Record<ToneName, string> = {
  brand: "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand)]",
  sale: "bg-[color:var(--color-sale)] text-white",
  local: "bg-[color:var(--color-local-soft)] text-[color:var(--color-local)]",
  import: "bg-[color:var(--color-import-soft)] text-[color:var(--color-import)]",
  success: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]",
  warn: "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)]",
  neutral: "bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-muted)]",
  dark: "bg-[color:var(--color-ink)] text-white",
};

export function Tag({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: ToneName;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-1.5 py-[3px] text-[10px] font-bold uppercase tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Buttons
   -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "brandGhost";
type ButtonSize = "sm" | "md" | "lg";

/**
 * Only `primary` carried a disabled appearance, so a disabled secondary,
 * ghost or dark button looked exactly like a working one — you found out by
 * clicking. That went unnoticed while nothing important was ever disabled;
 * "Add to cart" on a product that sells by option is disabled until a
 * combination is chosen, so the state now has to be visible.
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-brand)] text-white shadow-[var(--shadow-brand)] hover:bg-[color:var(--color-brand-strong)] active:translate-y-px disabled:bg-[color:var(--color-line-strong)] disabled:shadow-none",
  secondary:
    "bg-[color:var(--color-surface)] text-[color:var(--color-ink)] border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-ink)] active:translate-y-px disabled:bg-[color:var(--color-canvas)] disabled:text-[color:var(--color-ink-faint)] disabled:border-[color:var(--color-line)] disabled:hover:border-[color:var(--color-line)]",
  brandGhost:
    "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)] border border-[color:var(--color-brand-200)] hover:bg-[color:var(--color-brand-100)] disabled:bg-[color:var(--color-canvas)] disabled:text-[color:var(--color-ink-faint)] disabled:border-[color:var(--color-line)]",
  ghost:
    "bg-transparent text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)] disabled:text-[color:var(--color-ink-faint)] disabled:hover:bg-transparent",
  dark: "bg-[color:var(--color-ink)] text-white hover:opacity-90 active:translate-y-px disabled:bg-[color:var(--color-line-strong)] disabled:hover:opacity-100",
};

// Every size clears the 44px comfortable-tap floor except `sm`, which is only
// used beside another control on a desktop-width row.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-7 text-[15px]",
};

/**
 * The shared button appearance, so a link that looks like a button is styled
 * from the same source as the button itself.
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-bold transition-all duration-150 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`;
}

/**
 * A link that looks like a button.
 *
 * Wrapping `<Button>` in a `<Link>` produces `<a><button></button></a>`, which
 * is invalid — nested interactive elements — and it makes the anchor collapse
 * to its inline line box, so the thing a screen reader and the accessibility
 * tree treat as the control is a sliver rather than the button you can see.
 * This renders one element that is both.
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Fields
   -------------------------------------------------------------------------- */

const FIELD_BASE =
  "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-3 text-[15px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] transition-colors focus:border-[color:var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-200)]";

/**
 * A labelled field.
 *
 * The label is a real `<label>` bound to the control, and the error is wired
 * through `aria-describedby`, so the form is usable without sight of it.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  id,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (props: { id: string; className: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  id: string;
  className?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-[color:var(--color-ink)]">
        {label}
        {required ? <span className="ml-0.5 text-[color:var(--color-sale)]">*</span> : null}
      </label>

      {children({
        id,
        className: `${FIELD_BASE} ${error ? "border-[color:var(--color-danger)]" : ""}`,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[12px] font-semibold text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[12px] text-[color:var(--color-ink-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Height classes to pair with `Field`'s className for each control type. */
export const FIELD_HEIGHT = "h-12";
export const FIELD_TEXTAREA = "py-2.5 leading-relaxed";

/* --------------------------------------------------------------------------
   States
   -------------------------------------------------------------------------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** Shared empty / error presentation so no page ever renders blank. */
export function EmptyState({
  icon,
  title,
  message,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-16 text-center ${className}`}>
      {icon ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-400)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-extrabold">{title}</h2>
      {message ? (
        <p className="max-w-md text-sm leading-relaxed text-[color:var(--color-ink-muted)]">{message}</p>
      ) : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * An inline message. Used for form-level errors and confirmations, where a
 * toast would be missed and a full empty state would be too much.
 */
export function Notice({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: "info" | "success" | "warn" | "danger";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-strong)] border-[color:var(--color-brand-200)]",
    success: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] border-[color:var(--color-local-line)]",
    warn: "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)] border-[color:var(--color-warn)]/25",
    danger: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-[color:var(--color-danger)]/25",
  }[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-[13px] leading-relaxed ${tones} ${className}`}
    >
      {title ? <p className="font-extrabold">{title}</p> : null}
      {children}
    </div>
  );
}

/** Section heading with an optional action on the right. */
export function SectionHead({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[18px] font-black tracking-[-0.02em] sm:text-[22px]">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
