import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Your account",
  description: "Your 2KONECT orders, sourcing requests, deliveries, addresses and saved items.",
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
