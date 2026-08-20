import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Product",
  description: "Price, seller, availability and the delivery window — everything a 2KONECT listing tells you before you buy.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
