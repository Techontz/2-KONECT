"use client";

import { useEffect, useState } from "react";

/**
 * False during the server render and during the first client render, true
 * afterwards.
 *
 * Needed because auth state is restored from browser storage in an effect,
 * and Suspense boundaries hydrate independently: by the time a lazily
 * hydrated subtree renders, the provider's effect has already run, so a
 * component that branches on "signed in?" produces different markup from
 * what the server sent and React discards the tree.
 *
 * Gating the branch on this keeps the first render identical everywhere, and
 * the real answer arrives one tick later.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
