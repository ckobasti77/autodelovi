import { describe, expect, it, test } from "vitest";

import {
  isWithinOpeningHours,
  reminderLevelFor,
  slaLevel,
  workingMinutesBetween,
} from "@/lib/domain/sla";
import { belgradeLocalToUtc } from "@/lib/domain/time";

const HOURS = [
  { day: 1, open: "08:00", close: "17:00", closed: false },
  { day: 2, open: "08:00", close: "17:00", closed: false },
  { day: 3, open: "08:00", close: "17:00", closed: false },
  { day: 4, open: "08:00", close: "17:00", closed: false },
  { day: 5, open: "08:00", close: "17:00", closed: false },
  { day: 6, open: "08:00", close: "14:00", closed: false },
  { day: 0, open: "00:00", close: "00:00", closed: true },
];
const at = (y: number, m: number, d: number, h: number, mi = 0) =>
  belgradeLocalToUtc(y, m, d, h, mi);

describe("workingMinutesBetween", () => {
  test("counts only opening hours inside one day", () => {
    // Wednesday 30.09.2026.
    expect(workingMinutesBetween(at(2026, 9, 30, 9), at(2026, 9, 30, 11, 14), HOURS)).toBe(134);
    expect(workingMinutesBetween(at(2026, 9, 30, 6), at(2026, 9, 30, 7, 59), HOURS)).toBe(0);
    expect(workingMinutesBetween(at(2026, 9, 30, 16), at(2026, 9, 30, 20), HOURS)).toBe(60);
  });

  test("skips the night, Sunday and holidays", () => {
    // Saturday 16:00 → Monday 09:00: Saturday closes 14:00, Sunday closed → 60 min on Monday.
    expect(workingMinutesBetween(at(2026, 10, 3, 16), at(2026, 10, 5, 9), HOURS)).toBe(60);
    // Friday 16:00 → Saturday 09:00 = 60 + 60.
    expect(workingMinutesBetween(at(2026, 10, 2, 16), at(2026, 10, 3, 9), HOURS)).toBe(120);
    // Monday is a holiday → only Tuesday counts.
    expect(
      workingMinutesBetween(at(2026, 10, 5, 7), at(2026, 10, 6, 9), HOURS, ["2026-10-05"]),
    ).toBe(60);
  });

  test("handles the DST switch night (last Sunday of October)", () => {
    // Sat 24.10. 13:00 → Mon 26.10. 08:30: 60 min Saturday + 30 min Monday.
    expect(workingMinutesBetween(at(2026, 10, 24, 13), at(2026, 10, 26, 8, 30), HOURS)).toBe(90);
  });

  test("falls back to wall-clock minutes without hours; never negative", () => {
    expect(workingMinutesBetween(0, 3_600_000, [])).toBe(60);
    expect(workingMinutesBetween(10, 5, HOURS)).toBe(0);
  });
});

describe("slaLevel", () => {
  test("ok → soon (last quarter) → late", () => {
    expect(slaLevel(30, 120)).toBe("ok");
    expect(slaLevel(90, 120)).toBe("soon");
    expect(slaLevel(120, 120)).toBe("late");
    expect(slaLevel(500, 0)).toBe("ok");
  });
});

describe("isWithinOpeningHours / reminderLevelFor (step 18)", () => {
  it("follows Belgrade wall time in summer and winter", () => {
    // Wed 30.09.2026 (CEST) and Wed 28.10.2026 (CET).
    expect(isWithinOpeningHours(at(2026, 9, 30, 7, 59), HOURS)).toBe(false);
    expect(isWithinOpeningHours(at(2026, 9, 30, 8, 0), HOURS)).toBe(true);
    expect(isWithinOpeningHours(at(2026, 9, 30, 16, 59), HOURS)).toBe(true);
    expect(isWithinOpeningHours(at(2026, 9, 30, 17, 0), HOURS)).toBe(false);
    expect(isWithinOpeningHours(at(2026, 10, 28, 8, 0), HOURS)).toBe(true);
    expect(isWithinOpeningHours(Date.UTC(2026, 9, 28, 6, 30), HOURS)).toBe(false); // 07:30 CET
    expect(isWithinOpeningHours(Date.UTC(2026, 9, 28, 7, 30), HOURS)).toBe(true); // 08:30 CET
  });

  it("closed days and holidays are never working time", () => {
    expect(isWithinOpeningHours(at(2026, 10, 4, 10), HOURS)).toBe(false); // Sunday
    expect(isWithinOpeningHours(at(2026, 10, 3, 13, 59), HOURS)).toBe(true); // Saturday
    expect(isWithinOpeningHours(at(2026, 10, 3, 14, 0), HOURS)).toBe(false);
    expect(isWithinOpeningHours(at(2026, 11, 11, 10), HOURS, ["2026-11-11"])).toBe(false);
  });

  it("reminder levels: none, first at the target, second 120 working minutes later", () => {
    expect(reminderLevelFor(119, 120)).toBe(0);
    expect(reminderLevelFor(120, 120)).toBe(1);
    expect(reminderLevelFor(239, 120)).toBe(1);
    expect(reminderLevelFor(240, 120)).toBe(2);
    expect(reminderLevelFor(500, 0)).toBe(0);
  });
});
