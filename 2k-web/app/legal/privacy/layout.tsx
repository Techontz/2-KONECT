import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Privacy policy",
  description: "What 2KONECT collects when you use the marketplace, why we collect it, and the choices you have.",
  path: "/legal/privacy",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
