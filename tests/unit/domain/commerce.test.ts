import { describe, expect, test } from "vitest";

import {
  allCategorySlugs,
  allPartNodes,
  CATEGORIES,
  findCategory,
  findSubcategory,
  findSystem,
  isLeafCategory,
  STAGES,
  SUBCATEGORIES,
  SYSTEMS,
} from "@/lib/catalog/taxonomy";
import { fitStatus } from "@/lib/domain/fitment";
import {
  formatDocumentNumber,
  isValidEmail,
  isValidMb,
  isValidPib,
  isValidPostalCode,
  mbCheckDigit,
  normalizeEmail,
  paymentReference,
  pibCheckDigit,
} from "@/lib/domain/identifiers";
import { formatRsdPlain } from "@/lib/domain/money";
import { computeOrderTotals, deliveryPricePara, vatIncludedPara } from "@/lib/domain/orderTotals";
import { buildSearchText, classifyQuery, foldForSearch, looksLikeCode } from "@/lib/domain/search";
import { canOrderQuantity, deriveStockState, isAvailableNow } from "@/lib/domain/stock";
import {
  belgradeDay,
  belgradeLocalToUtc,
  belgradeOffsetMs,
  belgradeParts,
  belgradeYear,
  endOfBelgradeDay,
  formatBelgradeDate,
  formatBelgradeDateTime,
  isEuSummerTime,
} from "@/lib/domain/time";

describe("stock state", () => {
  const p = { allowBackorder: false };
  test("derivation", () => {
    expect(deriveStockState({ ...p, stockQty: 0 }, 3)).toBe("out_of_stock");
    expect(deriveStockState({ ...p, stockQty: 0, leadTimeDays: 3 }, 3)).toBe("on_order");
    expect(deriveStockState({ allowBackorder: true, stockQty: 0 }, 3)).toBe("on_order");
    expect(deriveStockState({ ...p, stockQty: 3 }, 3)).toBe("low_stock");
    expect(deriveStockState({ ...p, stockQty: 4 }, 3)).toBe("in_stock");
    expect(deriveStockState({ ...p, stockQty: 4, lowStockThreshold: 5 }, 3)).toBe("low_stock");
    expect(deriveStockState({ ...p, stockQty: -2 }, 3)).toBe("out_of_stock");
  });
  test("orderable quantities", () => {
    expect(canOrderQuantity({ ...p, stockQty: 2 }, 2)).toEqual({
      ok: true,
      backorder: false,
      available: 2,
    });
    expect(canOrderQuantity({ ...p, stockQty: 2 }, 3)).toEqual({
      ok: false,
      backorder: false,
      available: 2,
    });
    expect(canOrderQuantity({ ...p, stockQty: 0, leadTimeDays: 2 }, 3)).toEqual({
      ok: true,
      backorder: true,
      available: 0,
    });
    expect(isAvailableNow("low_stock")).toBe(true);
    expect(isAvailableNow("on_order")).toBe(false);
  });
});

describe("order totals", () => {
  test("sums, discount, free delivery and included VAT", () => {
    const totals = computeOrderTotals(
      [
        { quantity: 2, unitRetailPara: 500_000, unitPricePara: 450_000 },
        { quantity: 1, unitRetailPara: 100_000, unitPricePara: 100_000 },
      ],
      { pricePara: 45_000, freeOverPara: 1_000_000 },
      2_000,
    );
    expect(totals).toEqual({
      itemsRetailPara: 1_100_000,
      discountPara: 100_000,
      itemsPara: 1_000_000,
      deliveryPara: 0,
      totalPara: 1_000_000,
      vatPara: 166_667,
      currency: "RSD",
    });
  });
  test("delivery fee below the threshold and without a threshold", () => {
    expect(deliveryPricePara(999_999, { pricePara: 45_000, freeOverPara: 1_000_000 })).toBe(45_000);
    expect(deliveryPricePara(5_000_000, { pricePara: 45_000 })).toBe(45_000);
    expect(vatIncludedPara(120_000, 2_000)).toBe(20_000);
  });
  test("rejects non-integer quantities", () => {
    expect(() =>
      computeOrderTotals(
        [{ quantity: 0, unitRetailPara: 1, unitPricePara: 1 }],
        { pricePara: 0 },
        2_000,
      ),
    ).toThrow(RangeError);
  });
});

describe("identifiers", () => {
  test("PIB MOD 11,10", () => {
    expect(isValidPib("104052135")).toBe(true);
    expect(isValidPib("104 052 135")).toBe(true);
    expect(isValidPib("104052134")).toBe(false);
    expect(isValidPib("12345678")).toBe(false);
    expect(isValidPib("004052135")).toBe(false);
    expect(pibCheckDigit("10405213")).toBe(5);
  });
  test("MB mod 11", () => {
    expect(isValidMb("20084693")).toBe(true);
    expect(isValidMb("20084692")).toBe(false);
    expect(isValidMb("2008469")).toBe(false);
    expect(mbCheckDigit("2008469")).toBe(3);
  });
  test("postal code, e-mail, numbers", () => {
    expect(isValidPostalCode("11000")).toBe(true);
    expect(isValidPostalCode("1100")).toBe(false);
    expect(isValidEmail("kupac@primer.rs")).toBe(true);
    expect(isValidEmail("kupac@primer")).toBe(false);
    expect(normalizeEmail(" Kupac@Primer.RS ")).toBe("kupac@primer.rs");
    expect(formatDocumentNumber("SK", 2026, 123)).toBe("SK-2026-000123");
    expect(paymentReference("SK-2026-000123")).toBe("2026000123");
  });
});

describe("Belgrade time (EU DST without Intl)", () => {
  test("offsets around both DST switches of 2026", () => {
    // Summer time starts Sun 29 Mar 2026 01:00 UTC, ends Sun 25 Oct 2026 01:00 UTC.
    expect(isEuSummerTime(Date.UTC(2026, 2, 29, 0, 59))).toBe(false);
    expect(isEuSummerTime(Date.UTC(2026, 2, 29, 1, 0))).toBe(true);
    expect(isEuSummerTime(Date.UTC(2026, 9, 25, 0, 59))).toBe(true);
    expect(isEuSummerTime(Date.UTC(2026, 9, 25, 1, 0))).toBe(false);
    expect(belgradeOffsetMs(Date.UTC(2026, 6, 1))).toBe(2 * 3_600_000);
    expect(belgradeOffsetMs(Date.UTC(2026, 0, 1))).toBe(3_600_000);
  });
  test("local day and year across midnight and new year", () => {
    expect(belgradeDay(Date.UTC(2026, 8, 28, 22, 30))).toBe("2026-09-29");
    expect(belgradeYear(Date.UTC(2026, 11, 31, 23, 30))).toBe(2027);
    expect(belgradeParts(Date.UTC(2026, 8, 29, 9, 42))).toMatchObject({
      hour: 11,
      minute: 42,
      weekday: 2,
    });
  });
  test("local wall time to UTC and end of day", () => {
    expect(belgradeLocalToUtc(2026, 7, 1, 0, 0)).toBe(Date.UTC(2026, 5, 30, 22, 0));
    expect(belgradeLocalToUtc(2026, 3, 29, 3, 30)).toBe(Date.UTC(2026, 2, 29, 1, 30));
    expect(belgradeLocalToUtc(2026, 1, 15, 12, 0)).toBe(Date.UTC(2026, 0, 15, 11, 0));
    expect(endOfBelgradeDay(Date.UTC(2026, 8, 29, 10, 0))).toBe(Date.UTC(2026, 8, 29, 22, 0) - 1);
    expect(endOfBelgradeDay(Date.UTC(2026, 8, 29, 10, 0), 7)).toBe(Date.UTC(2026, 9, 6, 22, 0) - 1);
    // Across the October switch: 7 days after 20 Oct ends at 27 Oct 23:59:59.999 CET.
    expect(endOfBelgradeDay(Date.UTC(2026, 9, 20, 10, 0), 7)).toBe(
      Date.UTC(2026, 9, 27, 23, 0) - 1,
    );
  });
  test("Serbian date formats", () => {
    expect(formatBelgradeDate(Date.UTC(2026, 8, 29, 9, 0))).toBe("29.09.2026.");
    expect(formatBelgradeDateTime(Date.UTC(2026, 8, 29, 9, 5))).toBe("29.09.2026. 11:05");
  });
});

describe("search folding and classification", () => {
  test("folds diacritics and Cyrillic", () => {
    expect(foldForSearch("Kočione pločice — ĐAČKI")).toBe("kocione plocice djacki");
    expect(foldForSearch("кочионе плочице")).toBe("kocione plocice");
  });
  test("classifies codes, text and mixed queries", () => {
    expect(classifyQuery("1K0 615 301 AA")).toMatchObject({ kind: "code", codes: ["1K0615301AA"] });
    expect(classifyQuery("N 910 845 01")).toMatchObject({ kind: "code", codes: ["N91084501"] });
    expect(classifyQuery("DF6503")).toMatchObject({ kind: "code", codes: ["DF6503"] });
    expect(classifyQuery("1K0615301AA 5Q0615301F")).toMatchObject({
      kind: "code",
      codes: ["1K0615301AA", "5Q0615301F"],
    });
    expect(classifyQuery("kočione pločice golf")).toMatchObject({
      kind: "text",
      codes: [],
      text: "kocione plocice golf",
    });
    expect(classifyQuery("hladnjak golf 9")).toMatchObject({ kind: "text" });
    expect(classifyQuery("a4 b8")).toMatchObject({ kind: "text" });
    expect(classifyQuery("pločice 5Q0698151B")).toMatchObject({
      kind: "mixed",
      codes: ["5Q0698151B"],
      text: "plocice",
    });
    expect(looksLikeCode("abc")).toBe(false);
  });
  test("search text keeps raw and folded variants, capped", () => {
    expect(buildSearchText(["Kočioni disk", undefined, "ATE"])).toBe(
      "kočioni disk kocioni disk ate",
    );
    expect(buildSearchText(["x".repeat(2_000)]).length).toBe(1_500);
  });
});

describe("fitment check", () => {
  const rows = [
    { generationId: "g7", engineId: "tdi" },
    { generationId: "g6", yearFrom: 2009, yearTo: 2012 },
  ];
  test("statuses", () => {
    expect(fitStatus(rows, { generationId: "g7", engineId: "tdi" }, false)).toBe("fits");
    expect(fitStatus(rows, { generationId: "g7" }, false)).toBe("generation_only");
    expect(fitStatus(rows, { generationId: "g7", engineId: "tsi" }, false)).toBe("unknown");
    expect(fitStatus(rows, { generationId: "g6", year: 2010 }, false)).toBe("fits");
    expect(fitStatus(rows, { generationId: "g6", year: 2014 }, false)).toBe("unknown");
    expect(fitStatus(rows, { generationId: "g6", year: 2008 }, false)).toBe("unknown");
    expect(fitStatus([], { generationId: "g1" }, true)).toBe("universal");
    expect(fitStatus([], {}, true)).toBe("universal");
    expect(fitStatus([], {}, false)).toBe("unknown");
  });
});

describe("taxonomy (docs/3D-CONTRACT.md §F1)", () => {
  test("10 systems, 44 categories (42 with meshes, 91 nodes), 4 filter subcategories", () => {
    expect(SYSTEMS).toHaveLength(10);
    expect(CATEGORIES).toHaveLength(44);
    expect(CATEGORIES.filter((c) => c.instances.length > 0)).toHaveLength(42);
    expect(allPartNodes()).toHaveLength(91);
    expect(SUBCATEGORIES).toHaveLength(4);
    expect(new Set(allCategorySlugs()).size).toBe(48);
    expect(STAGES).toHaveLength(8);
  });
  test("every related slug and system exists; node names match the contract pattern", () => {
    const slugs = new Set(allCategorySlugs());
    for (const c of [...CATEGORIES, ...SUBCATEGORIES]) {
      expect(findSystem(c.system), c.slug).toBeDefined();
      for (const rel of c.relatedSlugs) expect(slugs.has(rel), `${c.slug} → ${rel}`).toBe(true);
      expect(c.relatedSlugs.length).toBeLessThanOrEqual(6);
    }
    for (const node of allPartNodes()) expect(node).toMatch(/^part__[a-z0-9-]+__[a-z0-9-]+$/);
    expect(isLeafCategory("filteri")).toBe(false);
    expect(isLeafCategory("filter-ulja")).toBe(true);
    expect(findCategory("turbina")?.stage).toBe(5);
    expect(findSubcategory("filter-kabine")?.parent).toBe("filteri");
  });
});

describe("Intl-free money", () => {
  test("formats like formatRSD", () => {
    expect(formatRsdPlain(1_299_000)).toBe("12.990 RSD");
    expect(formatRsdPlain(1_299_050)).toBe("12.990,50 RSD");
    expect(formatRsdPlain(-150_000)).toBe("−1.500 RSD");
    expect(formatRsdPlain(0)).toBe("0 RSD");
  });
});
