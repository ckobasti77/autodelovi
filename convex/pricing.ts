/**
 * Viewer-specific prices and price-tier management (docs/DATA-MODEL.md §C5).
 * `forProducts` is the only public price query besides the cart/part panel/live state;
 * tiers are visible to staff and editable by the owner.
 */
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { resolveUnitPrice } from "../lib/domain/pricing";
import { slugifySr } from "../lib/domain/slug";
import { audit, diffFields } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { showRetail } from "./lib/catalog";
import { invalid, notFound } from "./lib/errors";
import { ownerMutation, publicQuery, staffQuery } from "./lib/functions";
import {
  categoryPath,
  loadPricingContext,
  priceForViewer,
  type CategoryPathCache,
} from "./lib/pricing";
import { getSettings } from "./lib/settings";
import { categoryRuleV, manufacturerRuleV } from "./lib/validators";

export const forProducts = publicQuery({
  args: { productIds: v.array(v.id("products")) },
  returns: v.array(
    v.object({
      productId: v.id("products"),
      retailPricePara: v.union(v.number(), v.null()),
      yourPricePara: v.union(v.number(), v.null()),
      discountBp: v.number(),
    }),
  ),
  handler: async (ctx, { productIds }) => {
    if (productIds.length > 60) invalid("Najviše 60 artikala po upitu.");
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const pc = await loadPricingContext(ctx, ctx.viewer);
    const cache: CategoryPathCache = new Map();
    const out = [];
    for (const productId of [...new Set(productIds)]) {
      const p = await ctx.db.get("products", productId);
      if (!p) continue;
      const price = await priceForViewer(ctx, pc, p, cache);
      out.push({
        productId,
        retailPricePara: retailVisible ? p.retailPricePara : null,
        yourPricePara: price.yourPricePara,
        discountBp: price.discountBp,
      });
    }
    return out;
  },
});

const tierV = v.object({
  _id: v.id("priceTiers"),
  name: v.string(),
  slug: v.string(),
  defaultDiscountBp: v.number(),
  categoryRules: v.array(categoryRuleV),
  manufacturerRules: v.array(manufacturerRuleV),
  minMarginBp: v.union(v.number(), v.null()),
  active: v.boolean(),
  sortOrder: v.number(),
  isDefault: v.boolean(),
  publicDescription: v.union(v.string(), v.null()),
});

const toTier = (t: Doc<"priceTiers">) => ({
  _id: t._id,
  name: t.name,
  slug: t.slug,
  defaultDiscountBp: t.defaultDiscountBp,
  categoryRules: t.categoryRules,
  manufacturerRules: t.manufacturerRules,
  minMarginBp: t.minMarginBp ?? null,
  active: t.active,
  sortOrder: t.sortOrder,
  isDefault: t.isDefault,
  publicDescription: t.publicDescription ?? null,
});

export const listTiers = staffQuery({
  args: {},
  returns: v.array(tierV),
  handler: async (ctx) => {
    const rows = await ctx.db.query("priceTiers").withIndex("by_sortOrder").take(50);
    return rows.map(toTier);
  },
});

/** Public tier names and percentages for `/za-majstore` (active tiers only). */
export const publicTiers = publicQuery({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      defaultDiscountBp: v.number(),
      publicDescription: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("priceTiers").withIndex("by_sortOrder").take(50);
    return rows
      .filter((t) => t.active)
      .map((t) => ({
        name: t.name,
        defaultDiscountBp: t.defaultDiscountBp,
        publicDescription: t.publicDescription ?? null,
      }));
  },
});

/** Staff: what a tier would charge for given products (incl. margin guard). */
export const previewTier = staffQuery({
  args: { tierId: v.id("priceTiers"), productIds: v.array(v.id("products")) },
  returns: v.array(
    v.object({
      productId: v.id("products"),
      retailPricePara: v.number(),
      unitPricePara: v.number(),
      discountBp: v.number(),
      rule: v.string(),
      marginGuardApplied: v.boolean(),
    }),
  ),
  handler: async (ctx, { tierId, productIds }) => {
    if (productIds.length > 60) invalid("Najviše 60 artikala po upitu.");
    const tier = await ctx.db.get("priceTiers", tierId);
    if (!tier) return notFound("Cenovni razred ne postoji.");
    const settings = await getSettings(ctx);
    const cache: CategoryPathCache = new Map();
    const out = [];
    for (const productId of productIds) {
      const p = await ctx.db.get("products", productId);
      if (!p) continue;
      const priv = await ctx.db
        .query("productPrivate")
        .withIndex("by_productId", (q) => q.eq("productId", productId))
        .unique();
      const r = resolveUnitPrice({
        retailPricePara: p.retailPricePara,
        categoryPath: await categoryPath(ctx, p.categoryId, cache),
        manufacturerId: p.manufacturerId,
        ...(priv?.costNetPara !== undefined ? { costNetPara: priv.costNetPara } : {}),
        vatRateBp: settings.commerce.vatRateBp,
        globalMinMarginBp: settings.commerce.minMarginBp,
        tier: {
          defaultDiscountBp: tier.defaultDiscountBp,
          categoryRules: tier.categoryRules,
          manufacturerRules: tier.manufacturerRules,
          ...(tier.minMarginBp !== undefined ? { minMarginBp: tier.minMarginBp } : {}),
        },
      });
      out.push({
        productId,
        retailPricePara: p.retailPricePara,
        unitPricePara: r.unitPricePara,
        discountBp: r.discountBp,
        rule: r.rule,
        marginGuardApplied: r.marginGuardApplied,
      });
    }
    return out;
  },
});

const tierInputFields = {
  name: v.string(),
  defaultDiscountBp: v.number(),
  categoryRules: v.array(categoryRuleV),
  manufacturerRules: v.array(manufacturerRuleV),
  minMarginBp: v.optional(v.number()),
  sortOrder: v.number(),
  isDefault: v.boolean(),
  publicDescription: v.optional(v.string()),
};

function validateTier(t: {
  name: string;
  defaultDiscountBp: number;
  categoryRules: { discountBp: number }[];
  manufacturerRules: { discountBp: number }[];
  minMarginBp?: number;
}) {
  if (!t.name.trim() || t.name.length > 40)
    invalid("Naziv razreda je obavezan (do 40 znakova).", "name");
  const bps = [
    t.defaultDiscountBp,
    ...t.categoryRules.map((r) => r.discountBp),
    ...t.manufacturerRules.map((r) => r.discountBp),
  ];
  if (bps.some((bp) => !Number.isInteger(bp) || bp < 0 || bp > 9_000))
    invalid("Rabat mora biti između 0 i 90 %.", "discountBp");
  if (t.categoryRules.length > 100 || t.manufacturerRules.length > 200)
    invalid("Previše izuzetaka u razredu.");
  if (t.minMarginBp !== undefined && (t.minMarginBp < 0 || t.minMarginBp > 10_000))
    invalid("Neispravna minimalna marža.", "minMarginBp");
}

export const createTier = ownerMutation({
  args: tierInputFields,
  returns: v.id("priceTiers"),
  handler: async (ctx, args) => {
    validateTier(args);
    const slug = slugifySr(args.name);
    const taken = await ctx.db
      .query("priceTiers")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (taken) invalid("Razred sa tim nazivom već postoji.", "name");
    const tierId = await ctx.db.insert("priceTiers", {
      ...args,
      name: args.name.trim(),
      slug,
      active: true,
    });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "tier.create",
      entityType: "priceTier",
      entityId: tierId,
      summary: `Novi cenovni razred „${args.name.trim()}“ (${args.defaultDiscountBp / 100} %)`,
    });
    return tierId;
  },
});

export const updateTier = ownerMutation({
  args: { tierId: v.id("priceTiers"), ...tierInputFields },
  returns: v.null(),
  handler: async (ctx, { tierId, ...args }) => {
    const tier = await ctx.db.get("priceTiers", tierId);
    if (!tier) return notFound("Cenovni razred ne postoji.");
    validateTier(args);
    const patch = { ...args, name: args.name.trim() };
    const diff = diffFields(tier, patch);
    if (diff.length === 0) return null;
    await ctx.db.patch("priceTiers", tierId, patch);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "tier.update",
      entityType: "priceTier",
      entityId: tierId,
      summary: `Izmenjen cenovni razred „${patch.name}“`,
      diff,
    });
    return null;
  },
});

export const setTierActive = ownerMutation({
  args: { tierId: v.id("priceTiers"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { tierId, active }) => {
    const tier = await ctx.db.get("priceTiers", tierId);
    if (!tier) return notFound("Cenovni razred ne postoji.");
    if (tier.active === active) return null;
    await ctx.db.patch("priceTiers", tierId, { active });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: active ? "tier.activate" : "tier.archive",
      entityType: "priceTier",
      entityId: tierId,
      summary: `${active ? "Aktiviran" : "Arhiviran"} cenovni razred „${tier.name}“`,
    });
    return null;
  },
});
