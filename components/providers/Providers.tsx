"use client";

/**
 * Global client providers — kept minimal: Convex, tooltip timing, toasts.
 * Everything page-specific (cart, vehicle, live overlay) mounts in the (shop) layout.
 */
import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { Toaster } from "@/components/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
        {children}
        <Toaster />
      </TooltipPrimitive.Provider>
    </ConvexClientProvider>
  );
}
