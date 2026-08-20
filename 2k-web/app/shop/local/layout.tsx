import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Available in Tanzania",
  description: "Products already held by sellers in Tanzania. Pay, and they ship — delivered in one to three days across Dar es Salaam.",
  path: "/shop/local",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
