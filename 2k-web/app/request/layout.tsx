import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Request a product",
  description: "Can’t find it? Send 2KONECT a photo or a description and our sourcing team will find it, price it and bring it into Tanzania.",
  path: "/request",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
