/**
 * Server-side pricing (docs/DATA-MODEL.md §C5): loads the viewer's tier, personal rules and
 * the product cost, then calls the pure `resolveUnitPrice`. Only the final unit price leaves
 * this module — cost and rules never reach a client payload.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  resolveUnitPrice,
  type PersonalRules,
  type ResolvedUnitPrice,
  type TierRules,
} from "../../lib/domain/pricing";
import type { Viewer } from "./authz";
import { getSettings } from "./settings";

export type PricingContext = {
  profileId: Id<"mechanicProfiles">;
  tier: (TierRules & { id: Id<"priceTiers">; name: string }) | undefined;
  personal: PersonalRules | undefined;
  vatRateBp: number;
  globalMinMarginBp: number;
};

/** Pricing context for an approved mechanic; `null` for everyone else (retail prices). */
export async function loadPricingContext(
  ctx: QueryCtx,
  viewer: Viewer | null,
): Promise<PricingContext | null> {
  if (!viewer?.mechanic || viewer.mechanic.status !== "approved" || viewer.blocked) return null;
  const profile = await ctx.db.get("mechanicProfiles", viewer.mechanic.profileId);
  if (!profile || profile.userId !== viewer.userId) return null;
  return await pricingContextForProfile(ctx, profile);
}

/**
 * Pricing context of a mechanic profile (staff pricing a line for that mechanic's order);
 * `null` unless the profile is approved.
 */
export async function pricingContextForProfile(
  ctx: QueryCtx,
  profile: Doc<"mechanicProfiles">,
): Promise<PricingContext | null> {
  if (profile.status !== "approved") return null;
  const settings = await getSettings(ctx);
  let tier: PricingContext["tier"];
  if (profile.tierId) {
    const doc = await ctx.db.get("priceTiers", profile.tierId);
    if (doc && doc.active) {
      tier = {
        id: doc._id,
        name: doc.name,
        defaultDiscountBp: doc.defaultDiscountBp,
        categoryRules: doc.categoryRules,
        manufacturerRules: doc.manufacturerRules,
        ...(doc.minMarginBp !== undefined ? { minMarginBp: doc.minMarginBp } : {}),
      };
    }
  }
  return {
    profileId: profile._id,
    tier,
    personal: profile.personalRules,
    vatRateBp: settings.commerce.vatRateBp,
    globalMinMarginBp: settings.commerce.minMarginBp,
  };
}

/** Per-request cache of category ancestor paths (nearest first). */
export type CategoryPathCache = Map<Id<"categories">, Id<"categories">[]>;

export async function categoryPath(
  ctx: QueryCtx,
  categoryId: Id<"categories">,
  cache: CategoryPathCache,
): Promise<Id<"categories">[]> {
  const cached = cache.get(categoryId);
  if (cached) return cached;
  const path: Id<"categories">[] = [];
  let current: Id<"categories"> | undefined = categoryId;
  for (let depth = 0; current && depth < 6; depth++) {
    path.push(current);
    const doc: Doc<"categories"> | null = await ctx.db.get("categories", current);
    current = doc?.parentId;
  }
  cache.set(categoryId, path);
  return path;
}

export type ViewerPrice = {
  retailPricePara: number;
  /** The approved mechanic's unit price; `null` for every other viewer. */
  yourPricePara: number | null;
  discountBp: number;
};

type PricedProduct = Pick<
  Doc<"products">,
  "_id" | "retailPricePara" | "categoryId" | "manufacturerId"
>;

export async function resolveForContext(
  ctx: QueryCtx,
  pc: PricingContext,
  product: PricedProduct,
  cache: CategoryPathCache,
): Promise<ResolvedUnitPrice> {
  const path = await categoryPath(ctx, product.categoryId, cache);
  const priv = await ctx.db
    .query("productPrivate")
    .withIndex("by_productId", (q) => q.eq("productId", product._id))
    .unique();
  return resolveUnitPrice({
    retailPricePara: product.retailPricePara,
    categoryPath: path,
    manufacturerId: product.manufacturerId,
    ...(priv?.costNetPara !== undefined ? { costNetPara: priv.costNetPara } : {}),
    vatRateBp: pc.vatRateBp,
    globalMinMarginBp: pc.globalMinMarginBp,
    ...(pc.tier ? { tier: pc.tier } : {}),
    ...(pc.personal ? { personal: pc.personal } : {}),
  });
}

/** Retail for everyone; plus `yourPricePara` for an approved mechanic. */
export async function priceForViewer(
  ctx: QueryCtx,
  pc: PricingContext | null,
  product: PricedProduct,
  cache: CategoryPathCache,
): Promise<ViewerPrice> {
  if (!pc) {
    return { retailPricePara: product.retailPricePara, yourPricePara: null, discountBp: 0 };
  }
  const resolved = await resolveForContext(ctx, pc, product, cache);
  return {
    retailPricePara: product.retailPricePara,
    yourPricePara: resolved.unitPricePara,
    discountBp: resolved.discountBp,
  };
}
