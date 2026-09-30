/**
 * Working-time SLA arithmetic (admin inquiry/order queues, reminders). Pure — Belgrade wall
 * clock via `lib/domain/time`, opening hours and holidays from settings.
 */
import { belgradeLocalToUtc, belgradeParts, DAY_MS } from "./time";

export type OpeningHours = readonly { day: number; open: string; close: string; closed: boolean }[];

const MAX_DAYS = 62;

function hm(text: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h <= 24 && m < 60 ? { h, m } : null;
}

/**
 * Minutes of opening time between `fromMs` and `toMs` (Belgrade). Without configured hours
 * every minute counts (wall clock), so a shop that has not filled its hours still sees ages.
 */
export function workingMinutesBetween(
  fromMs: number,
  toMs: number,
  hours: OpeningHours,
  holidays: readonly string[] = [],
): number {
  if (toMs <= fromMs) return 0;
  const open = hours.filter((h) => !h.closed && hm(h.open) && hm(h.close));
  if (open.length === 0) return Math.floor((toMs - fromMs) / 60_000);
  const holidaySet = new Set(holidays);
  let total = 0;
  let cursor = fromMs;
  for (let i = 0; i < MAX_DAYS && cursor < toMs; i++) {
    const p = belgradeParts(cursor);
    const dayKey = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    const rule = open.find((h) => h.day === p.weekday);
    if (rule && !holidaySet.has(dayKey)) {
      const o = hm(rule.open)!;
      const c = hm(rule.close)!;
      const start = belgradeLocalToUtc(p.year, p.month, p.day, o.h, o.m);
      const end = belgradeLocalToUtc(p.year, p.month, p.day, c.h, c.m);
      const a = Math.max(start, fromMs);
      const b = Math.min(end, toMs);
      if (b > a) total += b - a;
    }
    // Next Belgrade midnight (DST-safe).
    const next = belgradeLocalToUtc(p.year, p.month, p.day + 1);
    cursor = next > cursor ? next : cursor + DAY_MS;
  }
  return Math.floor(total / 60_000);
}

export type SlaLevel = "ok" | "soon" | "late";

/** `late` past the target, `soon` in its last quarter. */
export function slaLevel(elapsedMinutes: number, targetMinutes: number): SlaLevel {
  if (targetMinutes <= 0) return "ok";
  if (elapsedMinutes >= targetMinutes) return "late";
  if (elapsedMinutes >= targetMinutes * 0.75) return "soon";
  return "ok";
}
