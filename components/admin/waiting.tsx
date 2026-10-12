/**
 * Waiting-time severity for the admin queues (dashboard „Red čekanja“, inquiry list).
 *
 * Ten rows that are all past the target used to be ten identical bold red timers. The time is
 * now neutral ink and the grade is a small icon + word beside it, so colour is never the only
 * carrier (DESIGN-SYSTEM §3.5) and a long queue stays readable:
 *
 *   ok        under 75 % of the target        „u roku“          no icon, ink-3
 *   soon      the last quarter before it      „rok ističe“      hourglass, warning
 *   late      past the target                 „kasni“           triangle, danger
 *   critical  three targets or more           „dugo kasni“      filled octagon, danger, semibold
 *
 * Presentation only: the arithmetic stays in `lib/domain/sla`.
 */
import {
  HourglassMediumIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { slaLevel } from "@/lib/domain/sla";

/** A wait this many times the target is no longer „late“ but „long overdue“. */
export const CRITICAL_FACTOR = 3;

export type WaitLevel = "ok" | "soon" | "late" | "critical";

export function waitLevel(elapsedMinutes: number, targetMinutes: number): WaitLevel {
  const level = slaLevel(elapsedMinutes, targetMinutes);
  if (level !== "late") return level;
  return elapsedMinutes >= targetMinutes * CRITICAL_FACTOR ? "critical" : "late";
}

export const WAIT_LEVELS: readonly WaitLevel[] = ["critical", "late", "soon", "ok"];

export const WAIT_LABEL: Record<WaitLevel, string> = {
  ok: "u roku",
  soon: "rok ističe",
  late: "kasni",
  critical: "dugo kasni",
};

/** What each grade means, for the legend's tooltip (the word itself is always visible). */
export const WAIT_HINT: Record<WaitLevel, string> = {
  ok: "Čeka kraće od tri četvrtine cilja.",
  soon: "Poslednja četvrtina vremena do cilja.",
  late: "Čeka duže od cilja.",
  critical: `Čeka najmanje ${CRITICAL_FACTOR} puta duže od cilja.`,
};

const WAIT_CLASS: Record<WaitLevel, string> = {
  ok: "text-ink-3",
  soon: "text-warning",
  late: "text-danger",
  critical: "font-semibold text-danger",
};

function WaitIcon({ level, size }: { level: WaitLevel; size: number }) {
  if (level === "soon") return <HourglassMediumIcon size={size} weight="bold" aria-hidden="true" />;
  if (level === "late") return <WarningIcon size={size} weight="bold" aria-hidden="true" />;
  if (level === "critical")
    return <WarningOctagonIcon size={size} weight="fill" aria-hidden="true" />;
  return null;
}

/** Icon + word for a level; `count` turns it into a legend entry („dugo kasni 8“). */
export function WaitMark({
  level,
  count,
  title,
  className,
}: {
  level: WaitLevel;
  count?: number;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap type-caption",
        WAIT_CLASS[level],
        className,
      )}
    >
      <WaitIcon level={level} size={13} />
      {WAIT_LABEL[level]}
      {count !== undefined ? <span className="tabular-nums text-ink-2">{count}</span> : null}
    </span>
  );
}
