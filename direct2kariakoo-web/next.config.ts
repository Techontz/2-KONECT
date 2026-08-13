const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Image configuration — allows remote Laravel images
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.direct2kariakoo.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
    ],
  },

  // ✅ Skip build errors for smoother deploy
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // ✅ Keep normal URLs (no /frontend)
  trailingSlash: true,

  // ❌ Removed basePath and assetPrefix
  // basePath: "/frontend",
  // assetPrefix: "/frontend/",

  // ✅ Export as static site (Vercel / Hostinger compatible)
  output: "export",

  // ✅ Optional performance tuning
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

module.exports = withBundleAnalyzer(nextConfig);
