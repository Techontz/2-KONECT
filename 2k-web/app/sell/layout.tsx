import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Sell with 2KONECT",
  description: "Reach buyers across Tanzania on a marketplace where every seller is reviewed before they list. Apply once — we handle approval and verification.",
  path: "/sell",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
