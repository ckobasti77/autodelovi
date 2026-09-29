import { describe, expect, test } from "vitest";

import {
  clampBp,
  marginFloorPara,
  matchDiscountRule,
  resolveUnitPrice,
  type PersonalRules,
  type TierRules,
} from "@/lib/domain/pricing";

const base = {
  retailPricePara: 1_000_000, // 10.000 RSD
  categoryPath: ["leaf", "parent", "system"],
  manufacturerId: "ate",
  vatRateBp: 2_000,
  globalMinMarginBp: 800,
};

const tier: TierRules = {
  defaultDiscountBp: 1_000,
  categoryRules: [{ categoryId: "parent", discountBp: 1_200 }],
  manufacturerRules: [{ manufacturerId: "ate", discountBp: 1_500 }],
};

const personal: PersonalRules = {
  defaultDiscountBp: 500,
  categoryRules: [{ categoryId: "system", discountBp: 700 }],
  manufacturerRules: [{ manufacturerId: "ate", discountBp: 2_500 }],
};

describe("matchDiscountRule precedence", () => {
  test("personal manufacturer wins over everything", () => {
    expect(matchDiscountRule({ ...base, tier, personal })).toEqual({
      discountBp: 2_500,
      rule: "manufacturer",
      source: "personal",
    });
  });
  test("tier manufacturer beats every category rule", () => {
    const p = { ...personal, manufacturerRules: [] };
    expect(matchDiscountRule({ ...base, tier, personal: p })).toEqual({
      discountBp: 1_500,
      rule: "manufacturer",
      source: "tier",
    });
  });
  test("personal category (any ancestor) beats tier category", () => {
    const t = { ...tier, manufacturerRules: [] };
    const p = { ...personal, manufacturerRules: [] };
    expect(matchDiscountRule({ ...base, tier: t, personal: p })).toEqual({
      discountBp: 700,
      rule: "category",
      source: "personal",
    });
  });
  test("tier category walks ancestors nearest first", () => {
    const t: TierRules = {
      defaultDiscountBp: 1_000,
      manufacturerRules: [],
      categoryRules: [
        { categoryId: "system", discountBp: 300 },
        { categoryId: "parent", discountBp: 1_200 },
      ],
    };
    expect(matchDiscountRule({ ...base, tier: t })).toEqual({
      discountBp: 1_200,
      rule: "category",
      source: "tier",
    });
  });
  test("personal default beats tier default", () => {
    const t = { ...tier, manufacturerRules: [], categoryRules: [] };
    expect(matchDiscountRule({ ...base, tier: t, personal: { defaultDiscountBp: 500 } })).toEqual({
      discountBp: 500,
      rule: "default",
      source: "personal",
    });
  });
  test("tier default when nothing else matches", () => {
    const t = { ...tier, manufacturerRules: [], categoryRules: [] };
    expect(matchDiscountRule({ ...base, tier: t, personal: {} })).toEqual({
      discountBp: 1_000,
      rule: "default",
      source: "tier",
    });
  });
  test("no tier and no personal rules → none", () => {
    expect(matchDiscountRule(base)).toEqual({ discountBp: 0, rule: "none", source: "none" });
  });
  test("a rule for another manufacturer/category does not match", () => {
    const t: TierRules = {
      defaultDiscountBp: 100,
      categoryRules: [{ categoryId: "other", discountBp: 900 }],
      manufacturerRules: [{ manufacturerId: "trw", discountBp: 900 }],
    };
    expect(matchDiscountRule({ ...base, tier: t })).toEqual({
      discountBp: 100,
      rule: "default",
      source: "tier",
    });
  });
  test("a personal 0 % rule is defined and wins (explicit no-discount)", () => {
    expect(
      matchDiscountRule({
        ...base,
        tier,
        personal: { manufacturerRules: [{ manufacturerId: "ate", discountBp: 0 }] },
      }),
    ).toEqual({
      discountBp: 0,
      rule: "manufacturer",
      source: "personal",
    });
  });
});

describe("resolveUnitPrice", () => {
  test("retail when no rule applies (keeps para exactly, no rounding)", () => {
    expect(resolveUnitPrice({ ...base, retailPricePara: 1_299_050 })).toEqual({
      unitPricePara: 1_299_050,
      discountBp: 0,
      rule: "none",
      source: "none",
      marginGuardApplied: false,
    });
  });

  test("applies the discount and rounds half up to whole dinars", () => {
    // 12.345,00 × 0,9 = 11.110,50 → 11.111
    const r = resolveUnitPrice({
      ...base,
      retailPricePara: 1_234_500,
      tier: { ...tier, manufacturerRules: [], categoryRules: [] },
    });
    expect(r.unitPricePara).toBe(1_111_100);
    expect(r.discountBp).toBe(1_000);
    // 12.344,00 × 0,9 = 11.109,60 → 11.110
    expect(
      resolveUnitPrice({
        ...base,
        retailPricePara: 1_234_400,
        tier: { ...tier, manufacturerRules: [], categoryRules: [] },
      }).unitPricePara,
    ).toBe(1_111_000);
  });

  test("custom rounding step", () => {
    const r = resolveUnitPrice({
      ...base,
      retailPricePara: 1_234_500,
      tier: { ...tier, manufacturerRules: [], categoryRules: [] },
      roundingPara: 1_000,
    });
    expect(r.unitPricePara).toBe(1_111_000);
  });

  test("margin guard raises a too-deep discount to cost + margin + VAT", () => {
    // cost 7.000 net → floor 7.000 × 1,08 × 1,2 = 9.072 RSD; 25 % would be 7.500.
    const r = resolveUnitPrice({ ...base, costNetPara: 700_000, tier, personal });
    expect(r).toEqual({
      unitPricePara: 907_200,
      discountBp: 928,
      rule: "manufacturer",
      source: "personal",
      marginGuardApplied: true,
    });
  });

  test("margin guard is not applied when the discounted price is above the floor", () => {
    const r = resolveUnitPrice({ ...base, costNetPara: 500_000, tier, personal });
    expect(r).toMatchObject({
      unitPricePara: 750_000,
      discountBp: 2_500,
      marginGuardApplied: false,
    });
  });

  test("floor at or above retail → retail with 0 % and the guard flag", () => {
    const r = resolveUnitPrice({ ...base, costNetPara: 800_000, tier });
    expect(r).toEqual({
      unitPricePara: 1_000_000,
      discountBp: 0,
      rule: "manufacturer",
      source: "tier",
      marginGuardApplied: true,
    });
  });

  test("tier minimum margin overrides the global one", () => {
    const withTierMargin = resolveUnitPrice({
      ...base,
      costNetPara: 600_000,
      tier: { ...tier, minMarginBp: 2_000 },
    });
    // floor 6.000 × 1,2 × 1,2 = 8.640 > 8.500 (15 %)
    expect(withTierMargin).toMatchObject({ unitPricePara: 864_000, marginGuardApplied: true });
    const global = resolveUnitPrice({ ...base, costNetPara: 600_000, tier });
    // floor 6.000 × 1,08 × 1,2 = 7.776 < 8.500
    expect(global).toMatchObject({ unitPricePara: 850_000, marginGuardApplied: false });
  });

  test("never above retail even with a tiny price and 100 % discount", () => {
    const r = resolveUnitPrice({
      ...base,
      retailPricePara: 150,
      tier: { ...tier, manufacturerRules: [{ manufacturerId: "ate", discountBp: 100 }] },
    });
    expect(r.unitPricePara).toBeLessThanOrEqual(150);
    const free = resolveUnitPrice({
      ...base,
      tier: { ...tier, manufacturerRules: [{ manufacturerId: "ate", discountBp: 10_000 }] },
    });
    expect(free.unitPricePara).toBe(0);
  });

  test("zero retail stays zero", () => {
    expect(resolveUnitPrice({ ...base, retailPricePara: 0, tier }).unitPricePara).toBe(0);
  });

  test("invalid money and rounding throw", () => {
    expect(() => resolveUnitPrice({ ...base, retailPricePara: -1 })).toThrow(RangeError);
    expect(() => resolveUnitPrice({ ...base, retailPricePara: 10.5 })).toThrow(RangeError);
    expect(() => resolveUnitPrice({ ...base, tier, costNetPara: -5 })).toThrow(RangeError);
    expect(() => resolveUnitPrice({ ...base, roundingPara: 0 })).toThrow(RangeError);
  });
});

describe("helpers", () => {
  test("clampBp clamps and drops non-finite values", () => {
    expect(clampBp(-5)).toBe(0);
    expect(clampBp(12_000)).toBe(10_000);
    expect(clampBp(Number.NaN)).toBe(0);
    expect(clampBp(1_234.6)).toBe(1_235);
  });
  test("marginFloorPara rounds up to whole dinars", () => {
    expect(marginFloorPara(100_001, 0, 0)).toBe(100_100);
    expect(marginFloorPara(100_000, 800, 2_000)).toBe(129_600);
    expect(marginFloorPara(100_000, 800, 2_000, 1)).toBe(129_600);
  });
});
