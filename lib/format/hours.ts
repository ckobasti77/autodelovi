/**
 * Opening hours → „Pon–pet 8–17, sub 8–14“. Pure and alias-free, so Convex (e-mails) and Next
 * share it.
 */
export type SettingsHours = readonly { day: number; open: string; close: string; closed: boolean }[];

const DAY_SHORT = ["ned", "pon", "uto", "sre", "čet", "pet", "sub"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function hhmm(value: string): string {
  const [h, m] = value.split(":");
  const hour = String(Number(h));
  return m && m !== "00" ? `${hour}:${m}` : hour;
}

/** „Pon–pet 8–17, sub 8–14“ (closed days omitted); empty when no hours are set. */
export function formatHours(hours: SettingsHours): string {
  const byDay = new Map(hours.map((h) => [h.day, h]));
  const groups: { from: number; to: number; label: string }[] = [];
  for (const day of WEEK_ORDER) {
    const h = byDay.get(day);
    if (!h || h.closed) continue;
    const label = `${hhmm(h.open)}–${hhmm(h.close)}`;
    const last = groups[groups.length - 1];
    const prevDay = last ? WEEK_ORDER[WEEK_ORDER.indexOf(day) - 1] : undefined;
    if (last && last.label === label && last.to === prevDay) last.to = day;
    else groups.push({ from: day, to: day, label });
  }
  const text = groups
    .map((g) =>
      g.from === g.to
        ? `${DAY_SHORT[g.from]} ${g.label}`
        : `${DAY_SHORT[g.from]}–${DAY_SHORT[g.to]} ${g.label}`,
    )
    .join(", ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
