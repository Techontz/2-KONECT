import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Your requests",
  description: "Products the 2KONECT sourcing team is finding for you.",
  index: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
