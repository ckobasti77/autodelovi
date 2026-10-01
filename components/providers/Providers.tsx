"use client";

/**
 * Global client providers — kept minimal: Convex and the toast queue (its viewport loads with
 * the first toast). Tooltips bring their own provider (components/ui/Tooltip), so the radix
 * tooltip/popper code loads only where a tooltip is rendered (PERF-09).
 * Everything page-specific (cart, vehicle, live overlay) mounts in the (shop) layout.
 */
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { Toaster } from "@/components/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      {children}
      <Toaster />
    </ConvexClientProvider>
  );
}
