"use client";

import { useEffect, useMemo, useState } from "react";

import shop from "./shop";
import type { CartQuote } from "./types";
import { keyOf, type CartLine } from "./store/cart";

/**
 * Prices the basket on the server.
 *
 * The cart in the browser knows what was picked up, not what it costs.
 * Quantity tiers in particular cannot be worked out client-side without
 * duplicating the rule — and a duplicated pricing rule is one that will
 * eventually disagree with the one that charges the card. So the basket is
 * sent as ids and quantities and the answer comes back priced.
 *
 * Falls back silently: if the request fails, the caller keeps rendering the
 * per-line prices it already has, which are right for every product without
 * tiers — that is, almost all of them. A cart that cannot be shown is worse
 * than a cart showing a price the checkout will confirm anyway.
 */
export function useCartQuote(lines: CartLine[], enabled = true) {
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(false);

  // The request depends on the ids and quantities, nothing else — so an
  // unrelated re-render does not re-price the basket.
  const signature = useMemo(
    () =>
      lines
        .map((line) => `${line.product.id}:${line.option?.id ?? ""}:${line.variant?.id ?? ""}:${line.quantity}`)
        .join("|"),
    [lines],
  );

  useEffect(() => {
    if (!enabled || lines.length === 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    shop
      .quote(
        lines.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
          offer_id: line.option?.id ?? null,
          variant_id: line.variant?.id ?? null,
        })),
      )
      .then((data) => { if (!cancelled) setQuote(data); })
      .catch(() => { if (!cancelled) setQuote(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  /** The quoted line matching a cart line, by the cart's own key. */
  const lineFor = useMemo(() => {
    const byKey = new Map<string, CartQuote["lines"][number]>();

    if (quote) {
      quote.lines.forEach((quoted, index) => {
        const cartLine = lines[index];
        if (cartLine) byKey.set(keyOf(cartLine), quoted);
      });
    }

    return (line: CartLine) => byKey.get(keyOf(line)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, signature]);

  return { quote, loading, lineFor };
}

export default useCartQuote;
