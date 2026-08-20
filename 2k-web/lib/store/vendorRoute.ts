"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "./auth";

/** Where a signed-in seller belongs. */
export const VENDOR_HOME = "/vendor/dashboard";

/**
 * Keeps a signed-in seller inside the seller console.
 *
 * This is deliberately one hook called from one place — `SiteChrome`, the
 * component every customer-facing route composes — rather than a redirect
 * bolted onto the login button. Doing it there means it covers logging in,
 * signing in with Google, completing a seller application, reopening the site
 * with a session still in storage, and typing a customer URL by hand, without
 * any of those paths having to know about it. Routes under /vendor render
 * their own shell and never mount this, so there is nothing to loop against.
 *
 * Role comes from the API — `user.role`, which the auth store already reads
 * from `/login`, `/register`, `/auth/google` and `/me`. Nothing here inspects
 * an email or an id.
 *
 * Returns true while the seller is being moved, so the caller can hold back
 * the customer interface instead of painting a frame of it first.
 */
export function useVendorRedirect(): boolean {
  const { ready, isVendor } = useAuth();
  const router = useRouter();

  // `ready` matters: until the stored session has been checked, the role is
  // unknown, and redirecting on an unknown role would bounce shoppers.
  const leaving = ready && isVendor;

  useEffect(() => {
    if (leaving) router.replace(VENDOR_HOME);
  }, [leaving, router]);

  return leaving;
}
