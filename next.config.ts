import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lazy-load heavy vendor bundles at build time.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  eslint: {
    // ESLint runs in CI (npm run lint) — keep builds lean.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Typechecking runs via `npm run typecheck`.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;