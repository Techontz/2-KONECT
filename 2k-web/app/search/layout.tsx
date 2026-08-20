import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Search",
  description: "Search the 2KONECT catalogue. Filter by whether a product is already in Tanzania or sourced from abroad, and by how soon you need it.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
