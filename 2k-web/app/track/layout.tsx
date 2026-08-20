import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Track your order",
  description: "Enter your 2KONECT order reference to see exactly where your package is, from the supplier’s door to yours.",
  path: "/track",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
