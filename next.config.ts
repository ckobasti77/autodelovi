import type { NextConfig } from "next";

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
    return [
      {
        source: "/styleguide",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
