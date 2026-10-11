"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useRef, type ReactNode } from "react";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { DUR } from "@/constants/motion";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Override the default 400 ms delay. */
  delayDuration?: number;
};

function TooltipBody({ children, side }: { children: ReactNode; side: TooltipProps["side"] }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0 },
        { opacity: 1, duration: prefersReducedMotion() ? 0 : DUR.instant, ease: "none" },
      );
    },
    { scope: ref },
  );
  return (
    <TooltipPrimitive.Content
      ref={ref}
      side={side}
      sideOffset={6}
      collisionPadding={8}
      className="z-tooltip max-w-60 rounded-sm border border-edge-overlay bg-surface-3 px-2 py-1.5 type-caption-s text-ink-1 shadow-overlay"
    >
      {children}
    </TooltipPrimitive.Content>
  );
}

/**
 * Tooltip (§9.22): surface-3, 12 px, appears after 400 ms in 80 ms. Supplementary only —
 * never the only way to learn something (the trigger keeps its own accessible name).
 *
 * Each tooltip carries its own radix Provider (nested providers are supported), so the
 * tooltip/popper code is not part of the root layout (PERF-09).
 */
export function Tooltip({ content, children, side = "top", delayDuration = 400 }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipBody side={side}>{content}</TooltipBody>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
