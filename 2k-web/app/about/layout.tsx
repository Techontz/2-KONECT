import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "About 2KONECT",
  description: "2KONECT connects people in Tanzania to what they need — whether it is already here, or halfway around the world.",
  path: "/about",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
