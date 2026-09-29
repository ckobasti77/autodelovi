/**
 * Mechanic price resolution (docs/DATA-MODEL.md §C5) — ONE pure function used by every
 * server path that prices a line for a viewer (catalog, cart, order submit, part panel,
 * price list). Never called in the browser: the inputs include the purchase cost.
 *
 * Money in integer para (1/100 RSD), discounts in basis points (1000 = 10 %).
 *
 * Precedence (first defined wins):
 *   personal.manufacturer → tier.manufacturer → personal.category (ancestors, nearest first)
 *   → tier.category (ancestors, nearest first) → personal.default → tier.default → 0.
 *
 * Price = round-half-up(retail × (10000 − bp) / 10000) to whole dinars (`roundingPara`).
 * Margin guard (only when a discount applies and the net cost is known):
 *   floor = ceilToDinar(costNet × (1 + minMarginBp/10000) × (1 + vatRateBp/10000))
 *   price = max(price, floor), never above retail; floor ≥ retail → retail with bp 0.
 */

export const BP_SCALE = 10_000;
export const DEFAULT_ROUNDING_PARA = 100;

export type CategoryDiscountRule = { categoryId: string; discountBp: number };
export type ManufacturerDiscountRule = { manufacturerId: string; discountBp: number };

export type TierRules = {
  defaultDiscountBp: number;
  categoryRules: readonly CategoryDiscountRule[];
  manufacturerRules: readonly ManufacturerDiscountRule[];
  /** Overrides the global minimum margin for this tier. */
  minMarginBp?: number;
};

export type PersonalRules = {
  defaultDiscountBp?: number;
  categoryRules?: readonly CategoryDiscountRule[];
  manufacturerRules?: readonly ManufacturerDiscountRule[];
};

export type PriceRule = "manufacturer" | "category" | "default" | "none";
export type PriceSource = "personal" | "tier" | "none";

export type ResolveUnitPriceInput = {
  retailPricePara: number;
  /** The product's category first, then its ancestors (nearest first). */
  categoryPath: readonly string[];
  manufacturerId: string;
  /** Purchase price excl. PDV; unknown → no margin guard. */
  costNetPara?: number;
  vatRateBp: number;
  globalMinMarginBp: number;
  tier?: TierRules;
  personal?: PersonalRules;
  /** Rounding step for discounted prices (default 100 para = whole dinars). */
  roundingPara?: number;
};

export type ResolvedUnitPrice = {
  unitPricePara: number;
  /** Effective discount versus retail (after the margin guard). */
  discountBp: number;
  rule: PriceRule;
  source: PriceSource;
  marginGuardApplied: boolean;
};

type MatchedRule = { discountBp: number; rule: PriceRule; source: PriceSource };

/** Clamps a discount to 0–100 % and drops non-finite values. */
export function clampBp(bp: number): number {
  if (!Number.isFinite(bp)) return 0;
  return Math.min(BP_SCALE, Math.max(0, Math.round(bp)));
}

function findManufacturer(
  rules: readonly ManufacturerDiscountRule[] | undefined,
  manufacturerId: string,
): number | undefined {
  return rules?.find((r) => r.manufacturerId === manufacturerId)?.discountBp;
}

function findCategory(
  rules: readonly CategoryDiscountRule[] | undefined,
  categoryPath: readonly string[],
): number | undefined {
  if (!rules || rules.length === 0) return undefined;
  for (const categoryId of categoryPath) {
    const hit = rules.find((r) => r.categoryId === categoryId);
    if (hit) return hit.discountBp;
  }
  return undefined;
}

/** Which rule decides the discount — exported for admin previews and tests. */
export function matchDiscountRule(
  input: Pick<ResolveUnitPriceInput, "categoryPath" | "manufacturerId" | "tier" | "personal">,
): MatchedRule {
  const { tier, personal, manufacturerId, categoryPath } = input;
  const candidates: Array<[number | undefined, PriceRule, PriceSource]> = [
    [findManufacturer(personal?.manufacturerRules, manufacturerId), "manufacturer", "personal"],
    [findManufacturer(tier?.manufacturerRules, manufacturerId), "manufacturer", "tier"],
    [findCategory(personal?.categoryRules, categoryPath), "category", "personal"],
    [findCategory(tier?.categoryRules, categoryPath), "category", "tier"],
    [personal?.defaultDiscountBp, "default", "personal"],
    [tier?.defaultDiscountBp, "default", "tier"],
  ];
  for (const [bp, rule, source] of candidates) {
    if (bp !== undefined) return { discountBp: clampBp(bp), rule, source };
  }
  return { discountBp: 0, rule: "none", source: "none" };
}

/** Integer round-half-up of `numerator / denominator` to a multiple of `step`. */
function roundHalfUpTo(numerator: number, denominator: number, step: number): number {
  const unit = denominator * step;
  return Math.floor((numerator + unit / 2) / unit) * step;
}

/** Integer ceil of `numerator / denominator` to a multiple of `step`. */
function ceilTo(numerator: number, denominator: number, step: number): number {
  const unit = denominator * step;
  return Math.ceil(numerator / unit) * step;
}

/** Minimum gross price that keeps `minMarginBp` over the net cost. */
export function marginFloorPara(
  costNetPara: number,
  minMarginBp: number,
  vatRateBp: number,
  roundingPara: number = DEFAULT_ROUNDING_PARA,
): number {
  const numerator = costNetPara * (BP_SCALE + minMarginBp) * (BP_SCALE + vatRateBp);
  return ceilTo(numerator, BP_SCALE * BP_SCALE, roundingPara);
}

function assertMoney(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (para), got ${value}`);
  }
}

export function resolveUnitPrice(input: ResolveUnitPriceInput): ResolvedUnitPrice {
  const retail = input.retailPricePara;
  assertMoney(retail, "retailPricePara");
  const rounding = input.roundingPara ?? DEFAULT_ROUNDING_PARA;
  if (!Number.isInteger(rounding) || rounding <= 0) {
    throw new RangeError(`roundingPara must be a positive integer, got ${rounding}`);
  }

  const matched = matchDiscountRule(input);
  if (matched.discountBp === 0 || retail === 0) {
    return {
      unitPricePara: retail,
      discountBp: 0,
      rule: matched.rule,
      source: matched.source,
      marginGuardApplied: false,
    };
  }

  let price = roundHalfUpTo(retail * (BP_SCALE - matched.discountBp), BP_SCALE, rounding);
  // Rounding a large discount on a tiny price must never exceed retail.
  price = Math.min(price, retail);
  let marginGuardApplied = false;

  if (input.costNetPara !== undefined) {
    assertMoney(input.costNetPara, "costNetPara");
    const minMarginBp = input.tier?.minMarginBp ?? input.globalMinMarginBp;
    const floor = marginFloorPara(input.costNetPara, minMarginBp, input.vatRateBp, rounding);
    if (floor >= retail) {
      return {
        unitPricePara: retail,
        discountBp: 0,
        rule: matched.rule,
        source: matched.source,
        marginGuardApplied: true,
      };
    }
    if (floor > price) {
      price = floor;
      marginGuardApplied = true;
    }
  }

  const discountBp = marginGuardApplied
    ? Math.round(((retail - price) * BP_SCALE) / retail)
    : matched.discountBp;
  return {
    unitPricePara: price,
    discountBp,
    rule: matched.rule,
    source: matched.source,
    marginGuardApplied,
  };
}
