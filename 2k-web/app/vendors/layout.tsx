import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Our sellers",
  description: "Approved stores trading on 2KONECT. Every one is reviewed before its products go live.",
  path: "/vendors",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
