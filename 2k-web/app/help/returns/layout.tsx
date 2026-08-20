import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Returns and refunds",
  description: "What to do if a 2KONECT order arrives damaged, faulty or not as described — including imported orders.",
  path: "/help/returns",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
