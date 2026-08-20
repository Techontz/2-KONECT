import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Seller guidelines",
  description: "What 2KONECT expects from stores selling on the marketplace: honest listings, accurate stock and delivery windows you can keep.",
  path: "/sell/guidelines",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
