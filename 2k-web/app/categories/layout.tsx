import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Browse every category",
  description: "Every category on 2KONECT, with local stock and imported options in each one.",
  path: "/categories",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
