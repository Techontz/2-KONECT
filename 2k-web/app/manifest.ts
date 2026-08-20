import type { MetadataRoute } from "next";

import { BRAND } from "@/lib/brand";

/** Installable-app metadata, so 2KONECT added to a home screen looks like one. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description: BRAND.promise,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6d28d9",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
