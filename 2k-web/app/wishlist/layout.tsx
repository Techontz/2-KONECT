import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Saved items",
  description: "Products you have kept for later on 2KONECT.",
  path: "/wishlist",
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
