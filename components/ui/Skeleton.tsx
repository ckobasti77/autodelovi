import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Skeleton block (§9.20): surface-2, radius 6, 1.6 s shimmer (static under reduced motion). */
export function Skeleton({ className, ...rest }: ComponentProps<"span">) {
  return <span aria-hidden="true" className={cn("skeleton block", className)} {...rest} />;
}

/** Text bars at 60–90 % widths, matching the line height of the text they stand in for. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-[90%]", "w-[76%]", "w-[84%]", "w-[62%]", "w-[70%]"];
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-[60%]" : widths[i % widths.length])}
        />
      ))}
    </span>
  );
}

/**
 * Busy region: `aria-busy` plus a visually hidden „Učitava se…“. Wrap skeletons that stand
 * in for a whole region so assistive technology knows content is coming.
 */
export function SkeletonRegion({
  label = "Učitava se…",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy="true" className={className} data-reveal="off">
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  );
}
