import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export type CardProps = ComponentProps<"div"> & {
  /** Hover steps the surface up, firms the edge and lifts 1 px (cards that are or hold a link). */
  interactive?: boolean;
  /** Level 2 at rest (sticky summaries, glare-prone list cards). */
  raised?: boolean;
  padding?: "none" | "md";
  asChild?: boolean;
};

/**
 * Card (§5.5): the `panel` surface — surface-1, 1 px line, radius 8, lit top edge — with
 * 16 px padding (12 px on phones). `raised` is level 2 (`panel-raised`).
 */
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
        "relative",
        raised ? "panel-raised" : "panel",
        interactive && "card-interactive",
        padding === "md" && "p-3 sm:p-4",
        className,
      )}
      {...rest}
    />
  );
}
