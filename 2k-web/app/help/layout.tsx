import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Help centre",
  description: "Find an answer about orders, delivery, importing, returns or your 2KONECT account — or talk to our support team.",
  path: "/help",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
