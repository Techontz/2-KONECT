"use client";

import Link from "next/link";

import { formatAmount, formatMoney } from "@/lib/format";
import type { Price, Rating } from "@/lib/types";
import { useT } from "@/lib/i18n";

/* ==========================================================================
   Small shared primitives.
   Each one exists because the reference storefront reuses the same visual
   element across cards, listings and the product page — defining them once
   keeps every surface consistent.
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
  size?: "sm" | "md" | "lg";
}) {
  const current =
    size === "lg" ? "text-[22px]" : size === "sm" ? "text-[13px]" : "text-[15px]";

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`${current} font-extrabold leading-tight text-[color:var(--color-ink)]`}>
        {formatMoney(price.current)}
      </span>

      {price.was !== null && price.discount_percent ? (
        <span className="flex flex-wrap items-center gap-1.5 text-[11px] leading-tight">
          <span className="text-[color:var(--color-ink-faint)] line-through">
            {formatAmount(price.was)}
          </span>
          <span className="font-bold text-[color:var(--color-sale)]">
            {price.discount_percent}% OFF
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
      <span className="inline-flex items-center gap-0.5 rounded-[var(--radius-xs)] bg-[color:var(--color-success-soft)] px-1.5 py-0.5 font-bold text-[color:var(--color-success)]">
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
    <span className="inline-flex items-center gap-0.5 text-[color:var(--color-success)]">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={`${className} ${star <= Math.round(value) ? "" : "text-[color:var(--color-line-strong)]"}`}
        />
      ))}
    </span>
  );
}

type ToneName = "express" | "sale" | "success" | "warn" | "neutral" | "action";

const TONES: Record<ToneName, string> = {
  express: "bg-[color:var(--color-express)] text-[color:var(--color-brand-ink)]",
  sale: "bg-[color:var(--color-sale)] text-white",
  success: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]",
  warn: "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)]",
  neutral: "bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-muted)]",
  action: "bg-[color:var(--color-action-soft)] text-[color:var(--color-action)]",
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
      className={`inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** The reference's black "express"-style delivery pill. */
export function DeliveryPill({ label }: { label?: string }) {
  const t = useT();

  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-[var(--radius-xs)] text-[10px] font-bold">
      <span className="bg-[color:var(--color-express)] px-1.5 py-0.5 italic text-[color:var(--color-brand-ink)]">
        {label ?? t("product.express")}
      </span>
      <span className="bg-[color:var(--color-ink)] px-1.5 py-0.5 text-white">{t("product.deliveryTomorrow")}</span>
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-action)] text-white hover:bg-[color:var(--color-action-dark)] disabled:bg-[color:var(--color-line-strong)]",
  secondary:
    "bg-[color:var(--color-surface)] text-[color:var(--color-ink)] border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-ink)]",
  ghost:
    "bg-transparent text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-alt)]",
  dark: "bg-[color:var(--color-ink)] text-white hover:opacity-90",
};

// Every size clears the 44px comfortable-tap floor except `sm`, which is only
// used beside another control on a desktop-width row.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-[15px]",
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
  return `inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-bold transition-colors disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`;
}

/**
 * A link that looks like a button.
 *
 * Wrapping `<Button>` in a `<Link>` produces `<a><button></button></a>`, which
 * is invalid — nested interactive elements — and it makes the anchor collapse
 * to its inline line box, so the thing a screen reader and the accessibility
 * tree treat as the control is a 22px sliver rather than the button you can
 * see. This renders one element that is both.
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
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button {...props} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-[var(--radius-sm)] ${className}`} />;
}

/** Shared empty / error presentation so no page ever renders blank. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-surface-alt)] text-[color:var(--color-ink-faint)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-bold">{title}</h2>
      {message ? (
        <p className="max-w-md text-sm text-[color:var(--color-ink-muted)]">{message}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
