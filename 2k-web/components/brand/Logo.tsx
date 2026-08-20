import Link from "next/link";

import { BRAND } from "@/lib/brand";

/**
 * The 2KONECT lockup: the official mark plus the wordmark.
 *
 * The wordmark is set in a single colour on purpose. Splitting it — a dark
 * "2" against a purple "KONECT" — reads as a brand called KONECT with a
 * numeral stuck on the front, which is not the name. One weight, one colour,
 * one word.
 *
 * One component so the header, footer, auth screens and the seller console all
 * render the same thing at the same proportions. `tone` picks the artwork that
 * has contrast against the surface it is placed on, rather than each caller
 * guessing which file to reference.
 */
export function Logo({
  tone = "light",
  size = "md",
  showWordmark = true,
  className = "",
}: {
  /** "light" = for light surfaces, "dark" = for brand-navy and other dark grounds. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  const mark = tone === "dark" ? BRAND.logo.white : BRAND.logo.brand;

  const dimensions = {
    sm: { box: "h-6 w-6", text: "text-[15px]", gap: "gap-1.5" },
    md: { box: "h-8 w-8", text: "text-[19px]", gap: "gap-2" },
    lg: { box: "h-11 w-11", text: "text-[26px]", gap: "gap-2.5" },
  }[size];

  return (
    <span className={`inline-flex items-center ${dimensions.gap} ${className}`}>
      {/* Decorative: the wordmark beside it carries the name, and when the
          wordmark is hidden the surrounding link is labelled instead. */}
      <img
        src={mark}
        alt=""
        aria-hidden="true"
        className={`${dimensions.box} shrink-0 object-contain`}
      />
      {showWordmark ? (
        <span
          className={`${dimensions.text} font-black leading-none tracking-[-0.035em] ${
            tone === "dark" ? "text-white" : "text-[color:var(--color-ink)]"
          }`}
        >
          {BRAND.name}
        </span>
      ) : null}
    </span>
  );
}

/** The logo as a link home, which is what it is almost everywhere. */
export function LogoLink({
  tone = "light",
  size = "md",
  showWordmark = true,
  className = "",
}: React.ComponentProps<typeof Logo>) {
  return (
    <Link href="/" aria-label={BRAND.name} className={`inline-flex items-center ${className}`} prefetch={false}>
      <Logo tone={tone} size={size} showWordmark={showWordmark} />
    </Link>
  );
}

export default Logo;
