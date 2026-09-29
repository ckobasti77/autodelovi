import { describe, expect, it } from "vitest";

import { formatDate, formatDateShort, formatDateTime } from "@/lib/format/date";

describe("formatDate / formatDateTime in Europe/Belgrade", () => {
  it.each([
    // Summer time (CEST, UTC+2)
    ["2026-09-29T09:42:00Z", "29.09.2026.", "29.09.2026. 11:42"],
    ["2026-06-30T22:15:00Z", "01.07.2026.", "01.07.2026. 00:15"],
    // Winter time (CET, UTC+1)
    ["2026-01-05T07:03:00Z", "05.01.2026.", "05.01.2026. 08:03"],
    ["2026-12-31T23:30:00Z", "01.01.2027.", "01.01.2027. 00:30"],
    ["2026-12-31T22:59:00Z", "31.12.2026.", "31.12.2026. 23:59"],
    // DST starts 29.03.2026. at 01:00 UTC: 02:00 local jumps to 03:00
    ["2026-03-29T00:59:00Z", "29.03.2026.", "29.03.2026. 01:59"],
    ["2026-03-29T01:00:00Z", "29.03.2026.", "29.03.2026. 03:00"],
    // DST ends 25.10.2026. at 01:00 UTC: 03:00 local falls back to 02:00
    ["2026-10-25T00:59:00Z", "25.10.2026.", "25.10.2026. 02:59"],
    ["2026-10-25T01:00:00Z", "25.10.2026.", "25.10.2026. 02:00"],
    // Local midnight renders as 00, never 24
    ["2026-09-28T22:00:00Z", "29.09.2026.", "29.09.2026. 00:00"],
  ])("%s → %s / %s", (iso, date, dateTime) => {
    expect(formatDate(iso)).toBe(date);
    expect(formatDateTime(iso)).toBe(dateTime);
  });

  it("accepts Date objects, epoch milliseconds and ISO strings alike", () => {
    const instant = Date.UTC(2026, 8, 29, 9, 42);
    expect(formatDate(new Date(instant))).toBe("29.09.2026.");
    expect(formatDate(instant)).toBe("29.09.2026.");
    expect(formatDate("2026-09-29")).toBe("29.09.2026.");
  });

  it("does not mutate a Date argument", () => {
    const date = new Date(Date.UTC(2026, 8, 29, 9, 42));
    formatDateTime(date);
    expect(date.toISOString()).toBe("2026-09-29T09:42:00.000Z");
  });

  it.each(["nije datum", Number.NaN, new Date(Number.NaN)])(
    "throws for invalid input %s",
    (input) => {
      expect(() => formatDate(input)).toThrow(RangeError);
    },
  );
});

describe("formatDateShort", () => {
  it.each([
    ["2026-09-29T09:42:00Z", "29.09."],
    ["2026-12-31T23:30:00Z", "01.01."],
    ["2026-03-01T12:00:00Z", "01.03."],
  ])("%s → %s", (iso, expected) => {
    expect(formatDateShort(iso)).toBe(expected);
  });
});
