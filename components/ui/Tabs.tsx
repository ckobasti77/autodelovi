"use client";

/**
 * Tabs (§9.16). Underline tabs: 44 px, 15 px 500 ink-2, active ink-1 with a 2 px accent
 * indicator that slides in 220 ms (sk.snap); panels swap instantly; overflow scrolls with an
 * edge fade. Segmented tabs (admin filters) carry counts. Radix handles arrow keys and ARIA.
 */
import { Tabs as TabsPrimitive } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { DUR, EASE } from "@/constants/motion";

export type TabItem = {
  value: string;
  label: ReactNode;
  /** Count shown after the label (segmented variant). */
  count?: number;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "underline" | "segmented";
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
};

function placeIndicator(list: HTMLElement, indicator: HTMLElement, animate: boolean) {
  const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
  if (!active) return;
  const vars = { x: active.offsetLeft, scaleX: active.offsetWidth, opacity: 1 };
  if (!animate || prefersReducedMotion()) gsap.set(indicator, vars);
  else gsap.to(indicator, { ...vars, duration: DUR.base, ease: EASE.snap });
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = "underline",
  label,
  className,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value ?? "");
  const current = value ?? internal;
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const firstPaint = useRef(true);

  // Slide the indicator to the active tab (instant on first paint and on resize).
  useGSAP(
    () => {
      const list = listRef.current;
      const indicator = indicatorRef.current;
      if (list && indicator) placeIndicator(list, indicator, !firstPaint.current);
      firstPaint.current = false;
    },
    { dependencies: [current], scope: listRef },
  );

  useGSAP(
    (_context, contextSafe) => {
      const list = listRef.current;
      const indicator = indicatorRef.current;
      if (!list || !indicator || !contextSafe || typeof ResizeObserver === "undefined") return;
      const onResize = contextSafe(() => placeIndicator(list, indicator, false));
      const observer = new ResizeObserver(onResize);
      observer.observe(list);
      return () => observer.disconnect();
    },
    { scope: listRef },
  );

  const handleChange = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <TabsPrimitive.Root value={current} onValueChange={handleChange} className={className}>
      <div className={cn("relative", variant === "underline" && "border-b border-line")}>
        <TabsPrimitive.List
          ref={listRef}
          aria-label={label}
          className={cn(
            "relative flex scroll-fade-x",
            variant === "underline"
              ? "gap-6"
              : "gap-1 rounded-xs border border-line bg-surface-1 p-1",
          )}
        >
          {items.map((item) => (
            <TabsPrimitive.Trigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap transition-control focus-ring-inset disabled:cursor-not-allowed disabled:text-ink-4",
                variant === "underline"
                  ? "h-11 text-[0.9375rem] font-medium text-ink-2 hover:text-ink-1 data-[state=active]:text-ink-1"
                  : "h-9 rounded-xs px-3 type-body-s font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink-1 data-[state=active]:bg-surface-3 data-[state=active]:text-ink-1",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="tabular-nums text-ink-3" data-reveal="off">
                  {item.count}
                </span>
              ) : null}
            </TabsPrimitive.Trigger>
          ))}
          {variant === "underline" ? (
            <span
              ref={indicatorRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-accent opacity-0"
            />
          ) : null}
        </TabsPrimitive.List>
      </div>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className="pt-4">
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
