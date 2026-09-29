"use client";

/**
 * Convex client for Client Components (useQuery / useMutation / useAuthActions).
 *
 * One ConvexReactClient per browser tab, created at module scope (it connects lazily on the
 * first subscription, so SSR never opens a socket). `ConvexAuthNextjsProvider` sends the
 * Convex Auth token (issued through the `/api/auth` proxy route; the refresh token stays in
 * an httpOnly cookie). The root layout also mounts `ConvexAuthNextjsServerProvider` — both
 * are required on Next 16 (docs/DECISIONS.md R1). Keep this file the single place that
 * constructs the client.
 */
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

export const convexClient: ConvexReactClient | null = url ? new ConvexReactClient(url) : null;

if (!convexClient && process.env.NODE_ENV !== "production") {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set — Convex hooks are unavailable.");
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Without a deployment URL the static shell still renders; live islands show their fallbacks.
  if (!convexClient) return <>{children}</>;
  return <ConvexAuthNextjsProvider client={convexClient}>{children}</ConvexAuthNextjsProvider>;
}
