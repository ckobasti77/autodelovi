/**
 * Europe/Belgrade local time without `Intl` (docs/NOTIFICATIONS.md §I3): CET (UTC+1) with
 * EU summer time (UTC+2) from the last Sunday of March 01:00 UTC to the last Sunday of
 * October 01:00 UTC. Pure — shared by Next and Convex (whose crons run in UTC).
 */

const HOUR = 3_600_000;
export const DAY_MS = 24 * HOUR;

/** 01:00 UTC on the last Sunday of the given month (0-based) of `year`. */
function lastSundayAt0100Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const back = lastDay.getUTCDay(); // 0 = Sunday
  return Date.UTC(year, month, lastDay.getUTCDate() - back, 1, 0, 0);
}

/** True when EU summer time is in force at the instant `ms` (UTC epoch). */
export function isEuSummerTime(ms: number): boolean {
  const year = new Date(ms).getUTCFullYear();
  return ms >= lastSundayAt0100Utc(year, 2) && ms < lastSundayAt0100Utc(year, 9);
}

/** Belgrade offset from UTC in milliseconds at `ms`. */
export function belgradeOffsetMs(ms: number): number {
  return isEuSummerTime(ms) ? 2 * HOUR : HOUR;
}

export type BelgradeParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

export function belgradeParts(ms: number): BelgradeParts {
  const local = new Date(ms + belgradeOffsetMs(ms));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    weekday: local.getUTCDay(),
  };
}

export function belgradeYear(ms: number): number {
  return belgradeParts(ms).year;
}

/** `YYYY-MM-DD` in Belgrade. */
export function belgradeDay(ms: number): string {
  const p = belgradeParts(ms);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * UTC instant of the local wall-clock time `y-m-d h:mi` in Belgrade. Around the DST switch
 * the offset is resolved from a first guess, which is exact for every existing local time.
 */
export function belgradeLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const guess = naive - HOUR;
  return naive - belgradeOffsetMs(guess);
}

/** Last millisecond of the Belgrade day that is `addDays` after the day containing `ms`. */
export function endOfBelgradeDay(ms: number, addDays = 0): number {
  const p = belgradeParts(ms);
  const next = belgradeLocalToUtc(p.year, p.month, p.day + addDays + 1);
  return next - 1;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `29.09.2026.` in Belgrade time, without `Intl` (safe in the Convex runtime). */
export function formatBelgradeDate(ms: number): string {
  const p = belgradeParts(ms);
  return `${pad2(p.day)}.${pad2(p.month)}.${p.year}.`;
}

/** `29.09.2026. 11:42` in Belgrade time, without `Intl`. */
export function formatBelgradeDateTime(ms: number): string {
  const p = belgradeParts(ms);
  return `${formatBelgradeDate(ms)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}
