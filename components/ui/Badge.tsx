import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone =
  "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  /** Needs action / selection („Nova“, chosen vehicle). */
  accent: "bg-accent-subtle text-accent-text",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
  /** Quality tag on product thumbnails. */
  outline: "border border-line-strong text-ink-2",
};

export type BadgeProps = ComponentProps<"span"> & {
  tone?: BadgeTone;
  /** Status icon — status is never colour-only (§3.5). */
  icon?: ReactNode;
  /** `label` = 11 px caps chip (tables, tags); `text` = 13 px sentence-case chip. */
  size?: "label" | "text";
};

/** Badge / chip (§9.22): 24 px, radius 4, subtle tint with icon + word. */
export function Badge({
  tone = "neutral",
  icon,
  size = "label",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      data-reveal="off"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs px-2",
        size === "label" ? "type-label" : "type-caption",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** Count badge — the only pill shape in the system (§5.3). */
export function CountBadge({
  count,
  max = 9,
  className,
  label,
}: {
  count: number;
  max?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      data-reveal="off"
      aria-label={label}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 font-ui text-[0.75rem] font-bold tabular-nums leading-none text-on-accent",
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
