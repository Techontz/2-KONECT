import Link from "next/link";

/**
 * The heading block every homepage section shares.
 *
 * One block, used everywhere, is what gives a long page a rhythm: the eye
 * learns the interval between "new section starts here" and the row beneath
 * it, and stops re-measuring. The reference recording does exactly this —
 * left-aligned title, optional line of explanation, and a quiet "view all"
 * pinned to the right edge on the same baseline.
 */
export function SectionHead({
  id,
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel = "View all",
  accent = "brand",
}: {
  id?: string;
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  accent?: "brand" | "local" | "import";
}) {
  const eyebrowTone = {
    brand: "text-[color:var(--color-ink-faint)]",
    local: "text-[color:var(--color-local)]",
    import: "text-[color:var(--color-import)]",
  }[accent];

  return (
    <div className="mb-3.5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className={`mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${eyebrowTone}`}>
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={id}
          className="text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-[color:var(--color-brand)] sm:text-[24px]"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-ink-muted)] sm:text-[14px]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="tap shrink-0 whitespace-nowrap rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-1.5 text-[12px] font-bold text-[color:var(--color-brand)] transition-colors hover:bg-[color:var(--color-brand-50)] sm:text-[13px]"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default SectionHead;
