"use client";

import type { SellerAttribute } from "@/lib/vendor";

export interface VariantDraft {
  sku: string;
  price: number | "";
  stock: number | "";
  /** `{ attribute_id: attribute_value_id }` */
  options: Record<number, number>;
}

/**
 * The seller's options-and-variants editor.
 *
 * Entirely optional, and off until the seller picks at least one option to
 * vary on — a product that does not need colours or sizes never sees a row.
 *
 * The option axes are the category's own attributes, the ones already used for
 * specifications, so a seller choosing "Colour" here is choosing the same
 * Colour the catalogue already knows about. Only attributes with a curated
 * list of values can be varied on: a free-text attribute has nothing to offer
 * as a choice.
 */
export function VariantEditor({
  attributes,
  axes,
  onAxes,
  variants,
  onChange,
  productPrice,
}: {
  attributes: SellerAttribute[];
  /** Attribute ids the product varies on. */
  axes: number[];
  onAxes(next: number[]): void;
  variants: VariantDraft[];
  onChange(next: VariantDraft[]): void;
  productPrice: number;
}) {
  // Only a curated list can become a choice.
  const selectable = attributes.filter((attribute) => (attribute.values?.length ?? 0) > 0);

  if (selectable.length === 0) return null;

  const chosen = selectable.filter((attribute) => axes.includes(attribute.id));

  const toggleAxis = (id: number) => {
    const next = axes.includes(id) ? axes.filter((a) => a !== id) : [...axes, id];
    onAxes(next);
    // Rows describe combinations of the old axes; keeping them after the axes
    // change would leave variants half-describing themselves.
    onChange([]);
  };

  const addRow = () =>
    onChange([...variants, { sku: "", price: "", stock: 0, options: {} }]);

  /**
   * Build every combination of the chosen axes that is not already listed.
   *
   * The alternative is a seller with three colours and three capacities
   * hand-picking nine pairs from nine dropdowns, which is nine chances to
   * mistype and one to give up. Existing rows are kept untouched — including
   * their prices and stock — so pressing this twice adds nothing, and rows the
   * seller deliberately deleted are the ones it puts back, which is why it is
   * offered rather than run automatically.
   */
  const generate = () => {
    const lists = chosen.map((attribute) =>
      (attribute.values ?? []).map((value) => ({ axis: attribute.id, value: value.id })),
    );

    if (lists.some((list) => list.length === 0)) return;

    // Cartesian product across the axes.
    let combos: Record<number, number>[] = [{}];
    for (const list of lists) {
      combos = combos.flatMap((combo) => list.map((entry) => ({ ...combo, [entry.axis]: entry.value })));
    }

    const key = (options: Record<number, number>) =>
      chosen.map((attribute) => `${attribute.id}:${options[attribute.id]}`).join("|");

    const already = new Set(variants.filter((v) => !incomplete(v, axes)).map((v) => key(v.options)));

    const additions = combos
      .filter((combo) => !already.has(key(combo)))
      .map((combo) => ({ sku: "", price: "" as const, stock: 0, options: combo }));

    if (additions.length) onChange([...variants, ...additions]);
  };

  const possible = chosen.reduce((total, attribute) => total * ((attribute.values ?? []).length || 1), 1);

  const update = (index: number, patch: Partial<VariantDraft>) =>
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));

  const duplicates = findDuplicates(variants, axes);

  return (
    <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      <h2 className="text-[15px] font-extrabold">Options and variants</h2>
      <p className="mb-3 text-[11px] text-[color:var(--color-ink-muted)]">
        Optional. Use this when the same product comes in choices a buyer has to
        make — a colour, a size, a storage capacity. Each combination keeps its
        own stock, and can set its own price.
      </p>

      <fieldset>
        <legend className="mb-1.5 text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
          What does this product vary on?
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {selectable.map((attribute) => (
            <button
              key={attribute.id}
              type="button"
              onClick={() => toggleAxis(attribute.id)}
              aria-pressed={axes.includes(attribute.id)}
              className={`tap min-h-11 rounded-[var(--radius-sm)] border px-3 text-[13px] font-bold ${
                axes.includes(attribute.id)
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                  : "border-[color:var(--color-line-strong)] bg-white text-[color:var(--color-ink)]"
              }`}
            >
              {attribute.name}
            </button>
          ))}
        </div>
      </fieldset>

      {chosen.length > 0 ? (
        <>
          <div className="mt-4 grid gap-2">
            {variants.map((variant, index) => (
              <div key={index} className="rounded-[var(--radius-sm)] border border-[color:var(--color-line)] p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {chosen.map((attribute) => (
                    <label key={attribute.id} className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
                        {attribute.name}
                      </span>
                      <select
                        value={variant.options[attribute.id] ?? ""}
                        onChange={(e) =>
                          update(index, {
                            options: { ...variant.options, [attribute.id]: Number(e.target.value) },
                          })
                        }
                        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                      >
                        <option value="">—</option>
                        {(attribute.values ?? []).map((value) => (
                          <option key={value.id} value={value.id}>{value.value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1.3fr_44px]">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-[color:var(--color-ink-muted)]">Stock</span>
                    <input
                      type="number" min={0} inputMode="numeric" value={variant.stock}
                      onChange={(e) => update(index, { stock: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
                      Price <span className="font-normal">(optional)</span>
                    </span>
                    <input
                      type="number" min={0} step="0.01" inputMode="decimal"
                      placeholder={String(productPrice || "Same as product")}
                      value={variant.price}
                      onChange={(e) => update(index, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
                      SKU <span className="font-normal">(optional)</span>
                    </span>
                    <input
                      type="text" maxLength={64} value={variant.sku}
                      onChange={(e) => update(index, { sku: e.target.value })}
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onChange(variants.filter((_, i) => i !== index))}
                    aria-label={`Remove variant ${index + 1}`}
                    className="tap h-11 w-11 shrink-0 self-end rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-[18px] font-bold text-[color:var(--color-ink-muted)] hover:border-[color:var(--color-sale)] hover:text-[color:var(--color-sale)]"
                  >
                    ×
                  </button>
                </div>

                {duplicates[index] ? (
                  <p role="alert" className="mt-1.5 text-[11.5px] font-semibold text-[color:var(--color-sale)]">
                    Another row already covers this combination.
                  </p>
                ) : incomplete(variant, axes) ? (
                  <p className="mt-1.5 text-[11.5px] text-[color:var(--color-ink-faint)]">
                    Choose a value for every option.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11.5px] text-[color:var(--color-ink-faint)]">
                    {variant.price === "" ? "Uses the product price." : "Has its own price."}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generate}
              className="tap h-11 rounded-[var(--radius-sm)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand)] px-4 text-[13px] font-bold text-white"
            >
              Generate all {possible} combinations
            </button>
            <button
              type="button"
              onClick={addRow}
              className="tap h-11 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-line-strong)] px-4 text-[13px] font-bold text-[color:var(--color-brand)] hover:border-[color:var(--color-brand)]"
            >
              {variants.length ? "Add one" : "Add a combination"}
            </button>
          </div>

          <p className="mt-1.5 text-[11.5px] text-[color:var(--color-ink-faint)]">
            Generating keeps the rows you already have. Delete any combination
            you do not sell — a shopper cannot choose one that is not listed.
          </p>
        </>
      ) : null}
    </section>
  );
}

export function incomplete(variant: VariantDraft, axes: number[]): boolean {
  return axes.some((axis) => !variant.options[axis]);
}

/** Row indexes that repeat a combination another row already covers. */
export function findDuplicates(variants: VariantDraft[], axes: number[]): boolean[] {
  const seen = new Map<string, number>();

  return variants.map((variant, index) => {
    if (incomplete(variant, axes)) return false;
    const key = axes.map((axis) => `${axis}:${variant.options[axis]}`).sort().join("|");
    if (seen.has(key) && seen.get(key) !== index) return true;
    if (!seen.has(key)) seen.set(key, index);
    return false;
  });
}

export default VariantEditor;
