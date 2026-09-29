import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** Keyboard key (§9.22): mono 12 px, 1 px control border. */
export function Kbd({ className, ...rest }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-control px-1 font-mono text-[0.75rem] leading-none text-ink-2",
        className,
      )}
      {...rest}
    />
  );
}
