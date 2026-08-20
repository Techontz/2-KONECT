import Link from "next/link";

/**
 * The banner at the top of a dedicated availability page.
 *
 * Both routes share this so the two halves of the marketplace read as two
 * halves of one thing rather than two designs, and each one always points at
 * the other — a shopper who lands on the wrong page should be one tap from
 * the right one.
 */
export function AvailabilityHeader({
  tone,
  flag,
  eyebrow,
  title,
  blurb,
  facts,
  otherHref,
  otherLabel,
}: {
  tone: "local" | "import";
  flag: string;
  eyebrow: string;
  title: string;
  blurb: string;
  facts: { label: string; value: string }[];
  otherHref: string;
  otherLabel: string;
}) {
  const accent =
    tone === "local"
      ? { text: "text-[color:var(--color-local)]", bg: "bg-[color:var(--color-local-soft)]", line: "border-[color:var(--color-local-line)]" }
      : { text: "text-[color:var(--color-import)]", bg: "bg-[color:var(--color-import-soft)]", line: "border-[color:var(--color-import-line)]" };

  return (
    <section className={`border-b ${accent.line} ${accent.bg}`}>
      <div className="shell py-6 sm:py-8">
        <p className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${accent.text}`}>
          <span aria-hidden="true" className="text-[15px] leading-none">{flag}</span>
          {eyebrow}
        </p>

        <h1 className="mt-1.5 max-w-2xl text-[26px] font-black leading-tight tracking-[-0.025em] sm:text-[34px]">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[color:var(--color-ink-soft)] sm:text-[15px]">
          {blurb}
        </p>

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                {fact.label}
              </dt>
              <dd className={`text-[15px] font-extrabold ${accent.text}`}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <Link
          href={otherHref}
          prefetch={false}
          className="mt-4 inline-flex min-h-11 items-center text-[13px] font-bold text-[color:var(--color-brand)] hover:underline"
        >
          {otherLabel}
        </Link>
      </div>
    </section>
  );
}
