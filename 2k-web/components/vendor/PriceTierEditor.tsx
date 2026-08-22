"use client";

import { useT, type Translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

export interface TierDraft {
  min_quantity: number | "";
  max_quantity: number | "";
  unit_price: number | "";
}

/**
 * The seller's bulk-pricing editor.
 *
 * Optional throughout: a product with no rows here is priced the ordinary way
 * and nothing about it changes.
 *
 * The overlap rule is enforced on the server, because that is where it has to
 * hold. It is also checked here so the seller finds out while they are looking
 * at the row rather than after pressing save — the message below each row is
 * the same complaint the server would make.
 */
export function PriceTierEditor({
  tiers,
  onChange,
}: {
  tiers: TierDraft[];
  onChange(next: TierDraft[]): void;
}) {
  const t = useT();
  const problems = validate(tiers, t);

  const update = (index: number, patch: Partial<TierDraft>) =>
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

  const add = () => {
    // Start the new row where the last one ended, which is what the seller
    // was going to type anyway.
    const last = tiers[tiers.length - 1];
    const start = last && last.max_quantity !== "" ? Number(last.max_quantity) + 1 : 1;
    onChange([...tiers, { min_quantity: start, max_quantity: "", unit_price: "" }]);
  };

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      <h2 className="text-[15px] font-extrabold">{t("productForm.bulkPricing")}</h2>
      <p className="mb-3 text-[11px] text-[color:var(--color-ink-muted)]">
        {t("productForm.bulkPricingHint")}
      </p>

      {tiers.length > 0 ? (
        <div className="grid gap-2">
          <div className="hidden gap-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)] sm:grid sm:grid-cols-[1fr_1fr_1.2fr_44px]">
            <span>{t("productForm.fromUnits")}</span>
            <span>{t("productForm.toBlank")}</span>
            <span>{t("productForm.priceEach")}</span>
            <span />
          </div>

          {tiers.map((tier, index) => (
            <div key={index}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_44px]">
                <input
                  type="number" min={1} inputMode="numeric"
                  aria-label={t("productForm.tierMin", { n: index + 1 })}
                  value={tier.min_quantity}
                  onChange={(e) => update(index, { min_quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                />
                <input
                  type="number" min={1} inputMode="numeric" placeholder={t("productForm.noLimit")}
                  aria-label={t("productForm.tierMax", { n: index + 1 })}
                  value={tier.max_quantity}
                  onChange={(e) => update(index, { max_quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                />
                <input
                  type="number" min={0} step="0.01" inputMode="decimal"
                  aria-label={t("productForm.tierPrice", { n: index + 1 })}
                  value={tier.unit_price}
                  onChange={(e) => update(index, { unit_price: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                />
                <button
                  type="button"
                  onClick={() => onChange(tiers.filter((_, i) => i !== index))}
                  aria-label={t("productForm.removeTier", { n: index + 1 })}
                  className="tap h-11 w-11 shrink-0 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-[18px] font-bold text-[color:var(--color-ink-muted)] hover:border-[color:var(--color-sale)] hover:text-[color:var(--color-sale)]"
                >
                  ×
                </button>
              </div>

              {problems[index] ? (
                <p role="alert" className="mt-1 text-[11.5px] font-semibold text-[color:var(--color-sale)]">
                  {problems[index]}
                </p>
              ) : (
                <p className="mt-1 text-[11.5px] text-[color:var(--color-ink-faint)]">
                  {describe(tier, t)}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={add}
        className="tap mt-3 h-11 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-line-strong)] px-4 text-[13px] font-bold text-[color:var(--color-brand)] hover:border-[color:var(--color-brand)]"
      >
        {tiers.length ? t("productForm.addAnotherTier") : t("productForm.addQuantityPricing")}
      </button>
    </section>
  );
}

function describe(tier: TierDraft, t: Translate): string {
  if (tier.min_quantity === "" || tier.unit_price === "") return t("productForm.tierIncomplete");
  const range = tier.max_quantity === ""
    ? t("productForm.tierOrMore", { count: Number(tier.min_quantity).toLocaleString() })
    : `${Number(tier.min_quantity).toLocaleString()}–${Number(tier.max_quantity).toLocaleString()}`;
  return t("productForm.tierEach", { range, price: formatMoney(Number(tier.unit_price)) });
}

/**
 * The same three rules the server applies, so the seller sees them first.
 *
 * @returns a message per row index, or an empty string where the row is fine
 */
export function validate(tiers: TierDraft[], t: Translate): string[] {
  const out = tiers.map(() => "");

  const filled = tiers
    .map((tier, index) => ({ tier, index }))
    .filter(({ tier }) => tier.min_quantity !== "");

  filled.forEach(({ tier, index }) => {
    if (Number(tier.min_quantity) < 1) out[index] = t("productForm.tierMinOne");
    else if (tier.max_quantity !== "" && Number(tier.max_quantity) < Number(tier.min_quantity)) {
      out[index] = t("productForm.tierMaxBelowMin");
    } else if (tier.unit_price !== "" && Number(tier.unit_price) < 0) {
      out[index] = t("productForm.tierNegative");
    }
  });

  const sorted = [...filled].sort((a, b) => Number(a.tier.min_quantity) - Number(b.tier.min_quantity));

  sorted.forEach(({ tier, index }, position) => {
    if (position === 0 || out[index]) return;
    const previous = sorted[position - 1].tier;

    if (previous.max_quantity === "") {
      out[index] = t("productForm.tierOnlyLastOpen");
    } else if (Number(tier.min_quantity) <= Number(previous.max_quantity)) {
      out[index] = t("productForm.tierOverlaps", { max: Number(previous.max_quantity).toLocaleString() });
    }
  });

  return out;
}

export default PriceTierEditor;
