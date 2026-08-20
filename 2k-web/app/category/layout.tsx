import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Category",
  description: "Browse a 2KONECT category — local stock and imported options side by side, with the delivery window on every listing.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
