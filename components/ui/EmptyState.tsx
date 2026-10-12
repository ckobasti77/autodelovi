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
  as?: "h1" | "h2" | "h3" | "p";
  /**
   * `start` on a left-aligned page (search results, lists, portal): the frame, the sentence
   * and the action sit on the page's left edge instead of floating in the middle of a wide
   * column. `center` (default) for dialogs, drawers and narrow columns.
   */
  align?: "center" | "start";
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
  align = "center",
  className,
}: EmptyStateProps) {
  const start = align === "start";
  return (
    <div
      className={cn(
        // No block padding in `start`: the page's own rhythm places it (class lists are joined,
        // not merged, so a caller could not take a default away).
        "flex flex-col gap-4",
        start ? "items-start text-left" : "items-center px-4 py-10 text-center",
        className,
      )}
    >
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
        <div className={cn("flex flex-wrap items-center gap-3", !start && "justify-center")}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
