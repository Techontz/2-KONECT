import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Terms and conditions",
  description: "The terms covering your use of 2KONECT — orders, prices, delivery estimates, imports, cancellations and returns.",
  path: "/legal/terms",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
