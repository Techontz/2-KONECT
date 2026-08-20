const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project has its own lockfile; without this Next walks up and picks
  // the one in the home directory as the workspace root, which puts the build
  // trace in the wrong place and warns on every build.
  outputFileTracingRoot: __dirname,

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "api.2konect.com", pathname: "/**" },
      { protocol: "https", hostname: "2konect.com", pathname: "/**" },
    ],
  },

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  trailingSlash: true,

  // 🚫 DO NOT USE output: "export" ON VERCEL

  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

module.exports = withBundleAnalyzer(nextConfig);
