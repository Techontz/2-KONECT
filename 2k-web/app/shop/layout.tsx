import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Shop everything",
  description: "Every product on 2KONECT — in stock in Tanzania now, or sourced from abroad for less. Filter by where it is and how soon you need it.",
  path: "/shop",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
