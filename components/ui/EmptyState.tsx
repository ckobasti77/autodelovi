import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  /** Part glyph or Phosphor icon at 32–48 px (rendered in ink-3). */
  icon: ReactNode;
  /** Optional short heading. */
  title?: ReactNode;
  /** One plain sentence. */
  children: ReactNode;
  /** One action — usually the inquiry. */
  action?: ReactNode;
  /** Heading level for the title (keeps the outline correct). */
  as?: "h2" | "h3" | "p";
  className?: string;
};

/**
 * Empty state (§6.5, §9.19): a drawing frame with corner ticks holding the glyph, one
 * sentence, one next action. No illustrations of people, no jokes.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  as: TitleTag = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-4 py-10 text-center", className)}>
      <div
        aria-hidden="true"
        className="corner-ticks flex h-28 w-full max-w-60 items-center justify-center text-ink-3 sm:h-40"
      >
        {icon}
      </div>
      <div className="flex max-w-[44ch] flex-col gap-1.5">
        {title ? <TitleTag className="type-h4 text-ink-1">{title}</TitleTag> : null}
        <p className="type-body text-ink-2">{children}</p>
      </div>
      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-3">{action}</div>
      ) : null}
    </div>
  );
}
