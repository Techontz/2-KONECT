import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Seller support",
  description: "Help for stores selling on 2KONECT — applying, approval, listing local and imported stock, orders and payouts.",
  path: "/sell/support",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
