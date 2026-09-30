import type { NextConfig } from "next";

import { staticSecurityHeaders, TOKEN_ROUTE_SOURCES } from "./lib/security/headers";

/** Convex file storage host for next/image (ARCHITECTURE §G7, §G11). */
function convexImageHost(): URL | null {
  const raw = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const convexHost = convexImageHost();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
    remotePatterns: convexHost
      ? [{ protocol: "https", hostname: convexHost.hostname, pathname: "/api/storage/**" }]
      : [],
  },
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async redirects() {
    return [
      // Step 03 concept route — its content lives on in the styleguide.
      { source: "/lab/koncept", destination: "/styleguide", permanent: true },
    ];
  },
  async headers() {
    // Security headers on every response (SECURITY §L3); the nonce CSP is set per request in
    // proxy.ts. Later entries override earlier ones for the same key.
    return [
      { source: "/:path*", headers: staticSecurityHeaders(process.env.NODE_ENV === "production") },
      ...TOKEN_ROUTE_SOURCES.map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
      {
        source: "/styleguide",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
