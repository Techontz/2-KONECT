"use client";

/**
 * How many are left, said the same way everywhere.
 *
 * One component for the card and the product page so a shopper is never told
 * "3 left" in the grid and "In stock" on the page they open. `size="sm"` is
 * the card's: a single line of small text that adds no height beyond the line
 * it occupies, because the card's vertical space was hard-won.
 *
 * An import is bought to order, so a zero on hand is not an absence — the
 * caller passes `toOrder` and the count is replaced by the fact that it is
 * sourced rather than stocked. Saying "Out of stock" there would turn a
 * perfectly buyable product away.
 */
export function StockLevel({
  stock,
  toOrder = false,
  size = "sm",
  className = "",
}: {
  stock: number;
  toOrder?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const text = size === "sm" ? "text-[10.5px] leading-[15px]" : "text-[13px]";

  if (toOrder) {
    return (
      <span className={`${text} font-medium text-[color:var(--color-import)] ${className}`}>
        Made to order
      </span>
    );
  }

  if (stock <= 0) {
    return (
      <span className={`${text} font-bold text-[color:var(--color-sale)] ${className}`}>
        Out of stock
      </span>
    );
  }

  // The threshold is the same one the low-stock badge already used, so the
  // urgent wording and the urgent badge agree.
  if (stock <= 5) {
    return (
      <span className={`${text} font-bold text-[color:var(--color-warn-ink,#8a5a00)] ${className}`}>
        {stock === 1 ? "Only 1 left" : `Only ${stock} left`}
      </span>
    );
  }

  return (
    <span className={`${text} font-medium text-[color:var(--color-ink-faint)] ${className}`}>
      {stock.toLocaleString()} in stock
    </span>
  );
}

export default StockLevel;
