/**
 * Dates in the Serbian format, always in the shop's time zone (Europe/Belgrade, CET/CEST),
 * regardless of where the code runs (server in UTC, browser abroad):
 *
 * - `formatDate`     → `29.09.2026.` (zero-padded, trailing dot)
 * - `formatDateTime` → `29.09.2026. 11:42` (24-hour clock)
 * - `formatDateShort`→ `29.09.` (admin tables)
 *
 * The string is assembled from `formatToParts` so the output does not depend on the ICU
 * build's pattern for `sr-Latn-RS`; Intl is only used for the time-zone conversion.
 */

export const TIME_ZONE = "Europe/Belgrade";

export type DateInput = Date | number | string;

type BelgradeParts = { day: string; month: string; year: string; hour: string; minute: string };

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toDate(input: DateInput): Date {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(input)}`);
  }
  return date;
}

function belgradeParts(input: DateInput): BelgradeParts {
  const parts: BelgradeParts = { day: "", month: "", year: "", hour: "", minute: "" };
  for (const part of partsFormat.formatToParts(toDate(input))) {
    if (part.type in parts) parts[part.type as keyof BelgradeParts] = part.value;
  }
  // Some engines still emit "24" for midnight despite h23.
  if (parts.hour === "24") parts.hour = "00";
  return {
    ...parts,
    day: parts.day.padStart(2, "0"),
    month: parts.month.padStart(2, "0"),
    hour: parts.hour.padStart(2, "0"),
    minute: parts.minute.padStart(2, "0"),
  };
}

/** `29.09.2026.` */
export function formatDate(input: DateInput): string {
  const { day, month, year } = belgradeParts(input);
  return `${day}.${month}.${year}.`;
}

/** `29.09.2026. 11:42` */
export function formatDateTime(input: DateInput): string {
  const { day, month, year, hour, minute } = belgradeParts(input);
  return `${day}.${month}.${year}. ${hour}:${minute}`;
}

/** `29.09.` — compact form for admin lists where the year is obvious. */
export function formatDateShort(input: DateInput): string {
  const { day, month } = belgradeParts(input);
  return `${day}.${month}.`;
}
