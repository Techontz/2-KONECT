import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Order from abroad",
  description: "Products sourced from suppliers outside Tanzania at a lower price. 2KONECT buys it, imports it and delivers it — tracked the whole way.",
  path: "/shop/abroad",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
