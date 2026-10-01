"use client";

/**
 * Convex client for Client Components (useQuery / useMutation / useAuthActions).
 *
 * One ConvexReactClient per browser tab, created at module scope (SSR never opens a socket).
 * `ConvexAuthNextjsProvider` sends the Convex Auth token (issued through the `/api/auth` proxy
 * route; the refresh token stays in an httpOnly cookie). The root layout also mounts
 * `ConvexAuthNextjsServerProvider` — both are required on Next 16 (docs/DECISIONS.md R1).
 * Keep this file the single place that constructs the client.
 *
 * The socket waits for `ConvexConnectionGate` (PERF-04): signed-in visitors connect at once;
 * anonymous visitors on their first interaction or once the page has loaded and gone idle,
 * so the connection never competes with hydration. Live islands render their server or
 * fallback state until then.
 */
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { useAuthToken } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useEffect, type ReactNode } from "react";

import { DeferredWebSocket, openConvexConnection } from "@/components/providers/deferredWebSocket";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

export const convexClient: ConvexReactClient | null = url
  ? new ConvexReactClient(url, {
      webSocketConstructor: DeferredWebSocket as unknown as typeof WebSocket,
    })
  : null;

if (!convexClient && process.env.NODE_ENV !== "production") {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set — Convex hooks are unavailable.");
}

/** Upper bound for the idle wait after `load` (busy main thread). */
const IDLE_TIMEOUT_MS = 1500;
const INTENT_EVENTS = ["pointerdown", "keydown", "focusin"] as const;

function ConvexConnectionGate(): null {
  const token = useAuthToken();

  useEffect(() => {
    if (token) {
      openConvexConnection();
      return;
    }
    let idleId = 0;
    let timer = 0;
    const open = () => {
      cleanup();
      openConvexConnection();
    };
    const afterLoad = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(open, { timeout: IDLE_TIMEOUT_MS });
      } else {
        timer = window.setTimeout(open, 200);
      }
    };
    function cleanup() {
      if (idleId) window.cancelIdleCallback(idleId);
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("load", afterLoad);
      for (const type of INTENT_EVENTS) window.removeEventListener(type, open, true);
    }
    for (const type of INTENT_EVENTS) window.addEventListener(type, open, true);
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return cleanup;
  }, [token]);

  return null;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Without a deployment URL the static shell still renders; live islands show their fallbacks.
  if (!convexClient) return <>{children}</>;
  return (
    <ConvexAuthNextjsProvider client={convexClient}>
      <ConvexConnectionGate />
      {children}
    </ConvexAuthNextjsProvider>
  );
}
