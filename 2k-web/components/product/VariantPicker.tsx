"use client";

import type { OptionAxis, ProductVariant } from "@/lib/types";
import { StockLevel } from "./StockLevel";

/**
 * The option selector, for products that sell by combination.
 *
 * Renders nothing when a product has no options, which is almost all of them.
 *
 * Two rules make it hard to get into a dead end:
 *
 *   - a value with no live variant behind it, given everything else currently
 *     chosen, is disabled rather than hidden. Hiding it would make the row
 *     reflow every time a colour changed; disabling it tells the shopper the
 *     combination exists as an idea but not as stock.
 *   - a value that is sold out is still selectable, so the page can say "Blue
 *     128GB is out of stock" rather than silently refusing the click. That is
 *     information, not an obstacle.
 */
export function VariantPicker({
  axes,
  variants,
  selection,
  onSelect,
  selected,
  className = "",
}: {
  axes: OptionAxis[];
  variants: ProductVariant[];
  /** `{ attribute_id: attribute_value_id }` */
  selection: Record<number, number>;
  onSelect(attributeId: number, valueId: number): void;
  selected: ProductVariant | null;
  className?: string;
}) {
  if (!axes.length) return null;

  /** Is there a live variant with this value, holding the other axes fixed? */
  const reachable = (axisId: number, valueId: number) =>
    variants.some((variant) => {
      const combo = Object.fromEntries(
        variant.options.map((o) => [o.attribute_id, o.attribute_value_id]),
      );
      if (combo[axisId] !== valueId) return false;

      return Object.entries(selection).every(
        ([otherAxis, otherValue]) =>
          Number(otherAxis) === axisId || combo[Number(otherAxis)] === otherValue,
      );
    });

  return (
    <div className={`grid gap-3 ${className}`}>
      {axes.map((axis) => (
        <fieldset key={axis.attribute_id} className="min-w-0">
          <legend className="mb-1.5 text-[12px] font-bold text-[color:var(--color-ink-soft)]">
            {axis.name}
            {axis.unit ? <span className="font-normal text-[color:var(--color-ink-faint)]"> ({axis.unit})</span> : null}
          </legend>

          <div className="flex flex-wrap gap-1.5">
            {axis.values.map((value) => {
              const isSelected = selection[axis.attribute_id] === value.id;
              const available = reachable(axis.attribute_id, value.id);

              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => onSelect(axis.attribute_id, value.id)}
                  disabled={!available}
                  aria-pressed={isSelected}
                  className={`tap min-h-11 rounded-[var(--radius-sm)] border px-3 text-[13px] font-bold transition-colors ${
                    isSelected
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                      : available
                        ? "border-[color:var(--color-line-strong)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-brand-400)]"
                        : "cursor-not-allowed border-[color:var(--color-line)] bg-[color:var(--color-canvas)] text-[color:var(--color-ink-faint)] line-through"
                  }`}
                >
                  {value.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {selected ? (
        <p className="text-[12.5px]">
          <StockLevel stock={selected.stock} size="md" />
          {selected.sku ? (
            <span className="ml-2 text-[11.5px] text-[color:var(--color-ink-faint)]">SKU {selected.sku}</span>
          ) : null}
        </p>
      ) : (
        <p className="text-[12.5px] font-medium text-[color:var(--color-ink-muted)]">
          Choose {axes.map((a) => a.name.toLowerCase()).join(" and ")} to see price and availability.
        </p>
      )}
    </div>
  );
}

export default VariantPicker;
