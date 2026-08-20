import type { Metadata } from "next";

import { pageMeta } from "@/lib/pageMeta";

/**
 * Metadata for this route.
 *
 * The page itself is a client component — it reads live catalogue data — so
 * it cannot export `metadata`. This thin server layout can.
 */
export const metadata: Metadata = pageMeta({
  title: "Contact us",
  description: "Talk to a person at 2KONECT about an order, a delivery, a sourcing request or your account.",
  path: "/help/contact",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
