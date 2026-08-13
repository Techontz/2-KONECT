"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ProductCard } from "../types";

/**
 * Shopping cart.
 *
 * A visitor can fill a cart before they have an account — that is the whole
 * point of browsing without a forced login. The cart therefore lives in
 * browser storage and is only sent to the server at checkout, when the
 * shopper has authenticated. Nothing here requires a session.
 */

export interface CartLine {
  product: ProductCard;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add(product: ProductCard, quantity?: number): void;
  setQuantity(productId: number, quantity: number): void;
  remove(productId: number): void;
  clear(): void;
  has(productId: number): boolean;
  quantityOf(productId: number): number;
}

const STORAGE_KEY = "d2k.cart.v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
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

  const add = useCallback((product: ProductCard, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);

      if (!existing) {
        // Never let a shopper add more than the vendor actually has.
        return [...current, { product, quantity: clamp(quantity, product.stock) }];
      }

      return current.map((line) =>
        line.product.id === product.id
          ? { ...line, quantity: clamp(line.quantity + quantity, product.stock) }
          : line
      );
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.product.id !== productId)
        : current.map((line) =>
            line.product.id === productId
              ? { ...line, quantity: clamp(quantity, line.product.stock) }
              : line
          )
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setLines((current) => current.filter((line) => line.product.id !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce(
      (sum, line) => sum + line.product.price.current * line.quantity,
      0
    );

    return {
      lines,
      count,
      subtotal,
      ready,
      add,
      setQuantity,
      remove,
      clear,
      has: (id) => lines.some((line) => line.product.id === id),
      quantityOf: (id) => lines.find((line) => line.product.id === id)?.quantity ?? 0,
    };
  }, [lines, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

function clamp(quantity: number, stock: number): number {
  const ceiling = stock > 0 ? stock : 1;
  return Math.max(1, Math.min(quantity, ceiling));
}
