"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { BuyingOption, ProductCard, ProductVariant, Sourcing } from "../types";

/**
 * Shopping cart.
 *
 * A visitor can fill a cart before they have an account — that is the whole
 * point of browsing without a forced login. The cart therefore lives in
 * browser storage and is only sent to the server at checkout, when the
 * shopper has authenticated. Nothing here requires a session.
 *
 * A line is a product *and the way it is being bought*: the local one and the
 * imported one are different prices with different arrival dates, so they are
 * two lines rather than one with a hidden variant. That is why every mutating
 * call takes a line key rather than a product id.
 */

export interface CartLine {
  product: ProductCard;
  quantity: number;
  /** The chosen alternative; absent means the product's own primary offer. */
  option?: BuyingOption;
  /**
   * The chosen combination, for a product that sells by option.
   *
   * Carried so the cart can show which one, and so checkout can name it to
   * the server. The price stored on it is only ever a *display* figure: the
   * server re-resolves every line at quote and again at order, so a stale
   * basket cannot fix a price.
   */
  variant?: ProductVariant;
  /**
   * The chosen values in words, for display in the cart.
   *
   * Kept beside the variant because the cart renders from what it holds, and
   * looking "Blue / 256GB" back up would mean shipping the whole option
   * vocabulary into the basket. Never used for pricing — that is the server's.
   */
  variantLabel?: string;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add(
    product: ProductCard,
    quantity?: number,
    option?: BuyingOption | null,
    variant?: ProductVariant | null,
    variantLabel?: string,
  ): void;
  setQuantity(key: string, quantity: number): void;
  remove(key: string): void;
  clear(): void;
  has(productId: number): boolean;
  /** Total units of a product across every way it is being bought. */
  quantityOf(productId: number): number;
  /** True when any line has to be brought into the country. */
  hasImports: boolean;
}

const STORAGE_KEY = "2konect.cart.v1";
/** The pre-rename key, read once so an in-flight cart survives the upgrade. */
const LEGACY_STORAGE_KEY = "d2k.cart.v1";

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Identifies a line: the product, which offer of it, and which combination.
 *
 * The variant is part of the key because black and blue are two lines, not one
 * line of two — merging them would lose the distinction the shopper just made.
 */
export function lineKey(
  productId: number,
  optionId?: number | null,
  variantId?: number | null,
): string {
  return `${productId}:${optionId ?? "primary"}:${variantId ?? "base"}`;
}

export function keyOf(line: CartLine): string {
  return lineKey(line.product.id, line.option?.id, line.variant?.id);
}

/**
 * What a line costs per unit, for display before the server has priced it.
 *
 * Precedence matches App\Support\Pricing on the server: the variant's price,
 * then the offer's, then the product's. Quantity tiers are deliberately not
 * applied here — the cart shows the server's quote for those, because guessing
 * at a tier in the browser and being corrected at checkout is worse than
 * waiting a moment for the real number.
 */
export function unitPrice(line: CartLine): number {
  return line.variant?.price.current ?? line.option?.price.current ?? line.product.price.current;
}

export function lineSourcing(line: CartLine): Sourcing | undefined {
  return line.option?.sourcing ?? line.product.sourcing;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  // Persist after hydration only, so an empty initial state cannot clobber a
  // cart saved in a previous session.
  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const add = useCallback((
    product: ProductCard,
    quantity = 1,
    option?: BuyingOption | null,
    variant?: ProductVariant | null,
    variantLabel?: string,
  ) => {
    const key = lineKey(product.id, option?.id, variant?.id);
    // A variant counts its own stock, so it is the ceiling when there is one.
    const ceiling = variant ? Math.max(variant.stock, 0) : ceilingFor(product, option);

    setLines((current) => {
      const existing = current.find((line) => keyOf(line) === key);

      if (!existing) {
        return [...current, {
          product,
          quantity: clamp(quantity, ceiling),
          option: option ?? undefined,
          variant: variant ?? undefined,
          variantLabel: variantLabel || undefined,
        }];
      }

      return current.map((line) =>
        keyOf(line) === key ? { ...line, quantity: clamp(line.quantity + quantity, ceiling) } : line,
      );
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => keyOf(line) !== key)
        : current.map((line) =>
            keyOf(line) === key
              ? {
                  ...line,
                  quantity: clamp(
                    quantity,
                    line.variant ? Math.max(line.variant.stock, 0) : ceilingFor(line.product, line.option),
                  ),
                }
              : line,
          ),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((line) => keyOf(line) !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);

    return {
      lines,
      count,
      subtotal,
      ready,
      add,
      setQuantity,
      remove,
      clear,
      hasImports: lines.some((line) => lineSourcing(line)?.is_local === false),
      has: (id) => lines.some((line) => line.product.id === id),
      quantityOf: (id) =>
        lines.reduce((sum, line) => (line.product.id === id ? sum + line.quantity : sum), 0),
    };
  }, [lines, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

/**
 * How many of this line a shopper may take.
 *
 * Local stock is finite and the cart must not promise more than the seller
 * holds. An import is bought to order, so it is capped by what checkout
 * accepts rather than by a shelf.
 */
function ceilingFor(product: ProductCard, option?: BuyingOption | null): number {
  const sourcing = option?.sourcing ?? product.sourcing;

  if (sourcing && !sourcing.is_local) return 99;

  const stock = option?.stock ?? product.stock;
  return stock > 0 ? stock : 1;
}

function clamp(quantity: number, ceiling: number): number {
  return Math.max(1, Math.min(quantity, ceiling));
}
