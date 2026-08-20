import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Delivery and shipping",
  description: "How your 2KONECT order reaches you, whether it starts in Dar es Salaam or in Shenzhen — routes, windows, charges and collection.",
  path: "/help/delivery",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
