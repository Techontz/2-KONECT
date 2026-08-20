import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/** @type {import("next").NextConfig} */
const nextConfig = {
  // This project has its own lockfile; without this Next walks up and picks
  // whichever one it finds first as the workspace root, which puts the build
  // trace in the wrong place and warns on every build.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),

  images: {
    // Product photography is served straight from the Laravel storage disk, so
    // there is no image optimiser in front of it to route through.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "api.2konect.com", pathname: "/**" },
      { protocol: "https", hostname: "2konect.com", pathname: "/**" },
    ],
  },

  // Both are checked in CI by `npm run typecheck` and `npm run lint`; failing
  // the build on them as well would only mean finding out twice.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  trailingSlash: true,

  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default withBundleAnalyzer(nextConfig);
