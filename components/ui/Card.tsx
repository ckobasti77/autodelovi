import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export type CardProps = ComponentProps<"div"> & {
  /** Hover raises the edge to line-strong (level 2). */
  interactive?: boolean;
  /** Level 2 at rest (sticky bars, glare-prone list cards). */
  raised?: boolean;
  padding?: "none" | "md";
  asChild?: boolean;
};

/** Card (§5.5 level 1): surface-1, 1 px line, radius 4, 16 px padding (12 px on phones). */
export function Card({
  interactive,
  raised,
  padding = "md",
  asChild,
  className,
  ...rest
}: CardProps) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={cn(
        "relative rounded-sm border bg-surface-1",
        raised ? "border-line-strong" : "border-line",
        interactive && "transition-control hover:border-line-strong",
        padding === "md" && "p-3 sm:p-4",
        className,
      )}
      {...rest}
    />
  );
}
