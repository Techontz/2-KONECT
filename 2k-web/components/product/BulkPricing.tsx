"use client";

import { formatMoney } from "@/lib/format";
import type { PriceTier } from "@/lib/types";

/**
 * The quantity-break table, and what the current quantity actually costs.
 *
 * Shown only when a seller has configured tiers; a product without them
 * renders nothing at all and reads exactly as it did before.
 *
 * The row matching the current quantity is marked, so the shopper can see both
 * what they are paying and what one more step up would save — which is the
 * entire point of publishing the table rather than just charging the right
 * price quietly.
 */
export function BulkPricing({
  tiers,
  quantity,
  className = "",
}: {
  tiers: PriceTier[];
  quantity: number;
  className?: string;
}) {
  if (!tiers.length) return null;

  const active = tiers.find(
    (tier) => quantity >= tier.min_quantity && (tier.max_quantity === null || quantity <= tier.max_quantity),
  );

  return (
    <section
      aria-labelledby="bulk-pricing"
      className={`rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4 ${className}`}
    >
      <h2 id="bulk-pricing" className="text-[13px] font-bold text-[color:var(--color-ink)]">
        Bulk pricing
      </h2>
      <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
        The more you buy, the less each one costs.
      </p>

      <table className="mt-2.5 w-full border-collapse text-[12.5px]">
        <caption className="sr-only">Unit price by quantity ordered</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[color:var(--color-ink-faint)]">
            <th scope="col" className="py-1 font-bold">Quantity</th>
            <th scope="col" className="py-1 text-right font-bold">Price each</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => {
            const isActive = active?.min_quantity === tier.min_quantity;
            return (
              <tr
                key={tier.min_quantity}
                aria-current={isActive ? "true" : undefined}
                className={
                  isActive
                    ? "bg-[color:var(--color-brand-50)] font-bold text-[color:var(--color-brand)]"
                    : "text-[color:var(--color-ink-soft)]"
                }
              >
                <td className="rounded-l-[var(--radius-xs)] py-1.5 pl-2">{tier.label}</td>
                <td className="rounded-r-[var(--radius-xs)] py-1.5 pr-2 text-right tabular-nums">
                  {formatMoney(tier.unit_price)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {active ? (
        <p className="mt-2.5 border-t border-[color:var(--color-line)] pt-2.5 text-[12.5px] text-[color:var(--color-ink-soft)]">
          <span className="font-bold text-[color:var(--color-ink)]">{quantity.toLocaleString()}</span>
          {" × "}
          <span className="font-bold text-[color:var(--color-ink)]">{formatMoney(active.unit_price)}</span>
          {" = "}
          <span className="font-black text-[color:var(--color-brand)]">
            {formatMoney(active.unit_price * quantity)}
          </span>
        </p>
      ) : null}
    </section>
  );
}

export default BulkPricing;
