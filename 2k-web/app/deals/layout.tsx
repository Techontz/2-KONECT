import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Deals",
  description: "Every discounted product on 2KONECT, biggest saving first — local stock and imported alike.",
  path: "/deals",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
