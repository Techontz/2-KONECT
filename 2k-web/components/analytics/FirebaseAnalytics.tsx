"use client";

import { useEffect } from "react";

import { startAnalytics } from "@/lib/firebase";

/**
 * Mounts Firebase Analytics, once, after the page is interactive.
 *
 * A component rather than a top-level import so the work happens in an effect
 * — effects do not run during server rendering, which is what keeps
 * `window is not defined` out of the build and out of hydration. It renders
 * nothing, so it contributes no markup to compare against.
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    void startAnalytics();
  }, []);

  return null;
}

export default FirebaseAnalytics;
