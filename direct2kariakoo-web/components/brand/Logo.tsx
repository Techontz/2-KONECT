import Link from "next/link";

import { BRAND } from "@/lib/brand";

/**
 * The 2KONECT lockup: the official mark plus the wordmark.
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
  /** "light" = for light surfaces, "dark" = for purple/dark surfaces. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  const mark = tone === "dark" ? BRAND.logo.white : BRAND.logo.purple;

  const dimensions = {
    sm: { box: "h-6 w-6", text: "text-[15px]" },
    md: { box: "h-8 w-8", text: "text-[19px]" },
    lg: { box: "h-11 w-11", text: "text-[26px]" },
  }[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
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
          className={`${dimensions.text} font-black leading-none tracking-[-0.03em] ${
            tone === "dark" ? "text-white" : "text-[color:var(--color-ink)]"
          }`}
        >
          {BRAND.wordmark.lead}
          <span className={tone === "dark" ? "text-[color:var(--color-brand-200)]" : "text-[color:var(--color-brand)]"}>
            {BRAND.wordmark.tail}
          </span>
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
