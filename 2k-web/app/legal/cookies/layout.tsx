import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Cookie policy",
  description: "What 2KONECT stores in your browser so the site remembers you between visits, and how to clear it.",
  path: "/legal/cookies",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
