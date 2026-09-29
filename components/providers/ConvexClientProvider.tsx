"use client";

/**
 * Convex client for Client Components (useQuery / useMutation).
 *
 * One ConvexReactClient per browser tab, created at module scope (it connects lazily on the
 * first subscription, so SSR never opens a socket). Step 05 replaces ConvexProvider with
 * ConvexAuthNextjsProvider and adds ConvexAuthNextjsServerProvider in the root layout —
 * keep this file the single place that constructs the client.
 */
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

export const convexClient: ConvexReactClient | null = url ? new ConvexReactClient(url) : null;

if (!convexClient && process.env.NODE_ENV !== "production") {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set — Convex hooks are unavailable.");
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Without a deployment URL the static shell still renders; live islands show their fallbacks.
  if (!convexClient) return <>{children}</>;
  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
