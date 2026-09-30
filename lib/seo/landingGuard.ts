/**
 * Thin-content guard for programmatic landings (SEO-ADS §J4). Pure — used by the hourly
 * Convex recompute (`convex/landings.ts`) and covered by unit tests.
 *
 * A landing is indexable only when it has enough fitting products for its level (brand /
 * model), at least two of them available now, and variety (≥ 2 manufacturers or ≥ 2
 * generations); then the global cap admits the best ranked ones (productCount × inStock).
 */

export type LandingLevel = "brand" | "model";

export type LandingCandidate = {
  level: LandingLevel;
  productCount: number;
  inStockCount: number;
  manufacturerCount: number;
  generationCount: number;
};

export type LandingMin = { brand: number; model: number };

export type LandingReason = "few_products" | "few_in_stock" | "low_variety" | "over_cap";

export const MIN_IN_STOCK = 2;

/** Why a candidate fails the guard (before the cap), or null when it passes. */
export function landingFailure(c: LandingCandidate, min: LandingMin): LandingReason | null {
  const required = c.level === "brand" ? min.brand : min.model;
  if (c.productCount < required) return "few_products";
  if (c.inStockCount < MIN_IN_STOCK) return "few_in_stock";
  if (c.manufacturerCount < 2 && c.generationCount < 2) return "low_variety";
  return null;
}

export function landingRank(c: Pick<LandingCandidate, "productCount" | "inStockCount">): number {
  return c.productCount * c.inStockCount;
}

/**
 * Final verdicts for candidates sorted by rank (descending): eligible ones are admitted until
 * `cap` is reached, the rest carry the reason they are `noindex`.
 */
export function applyLandingCap<T extends LandingCandidate>(
  sortedByRank: T[],
  min: LandingMin,
  cap: number,
): { row: T; indexable: boolean; reason: LandingReason | null }[] {
  let admitted = 0;
  return sortedByRank.map((row) => {
    const failure = landingFailure(row, min);
    if (failure) return { row, indexable: false, reason: failure };
    if (admitted >= cap) return { row, indexable: false, reason: "over_cap" };
    admitted++;
    return { row, indexable: true, reason: null };
  });
}

/** Serbian label of a guard reason (admin SEO overview). */
export const LANDING_REASON_LABEL: Record<LandingReason, string> = {
  few_products: "premalo artikala",
  few_in_stock: "manje od 2 artikla na stanju",
  low_variety: "samo jedan proizvođač i jedna generacija",
  over_cap: "iznad ograničenja broja strana",
};
