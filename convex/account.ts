/**
 * Customer account data (ARCHITECTURE §E2 `account`): saved vehicles and favorites. Every
 * function is a user function — the owner is always `ctx.viewer`, never an argument.
 */
import { v } from "convex/values";

import { normalizeVin, validateVin } from "../lib/domain/vin";
import { isListed, productCardV, toCard } from "./lib/catalog";
import { invalid, notFound } from "./lib/errors";
import { userMutation, userQuery } from "./lib/functions";
import { loadPricingContext, priceForViewer, type CategoryPathCache } from "./lib/pricing";

const MAX_SAVED_VEHICLES = 30;

const savedVehicleV = v.object({
  id: v.id("savedVehicles"),
  label: v.union(v.string(), v.null()),
  brandSlug: v.union(v.string(), v.null()),
  modelSlug: v.union(v.string(), v.null()),
  generationSlug: v.union(v.string(), v.null()),
  engineSlug: v.union(v.string(), v.null()),
  brandName: v.union(v.string(), v.null()),
  modelName: v.union(v.string(), v.null()),
  generationName: v.union(v.string(), v.null()),
  generationYears: v.union(
    v.null(),
    v.object({ from: v.number(), to: v.union(v.number(), v.null()) }),
  ),
  engineName: v.union(v.string(), v.null()),
  engineCodes: v.array(v.string()),
  vin: v.union(v.string(), v.null()),
  plate: v.union(v.string(), v.null()),
  note: v.union(v.string(), v.null()),
});

export const savedVehicles = userQuery({
  args: {},
  returns: v.array(savedVehicleV),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("savedVehicles")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .take(MAX_SAVED_VEHICLES);
    const out = [];
    for (const row of rows) {
      const brand = row.brandId ? await ctx.db.get("vehicleBrands", row.brandId) : null;
      const model = row.modelId ? await ctx.db.get("vehicleModels", row.modelId) : null;
      const generation = row.generationId
        ? await ctx.db.get("vehicleGenerations", row.generationId)
        : null;
      const engine = row.engineId ? await ctx.db.get("engines", row.engineId) : null;
      out.push({
        id: row._id,
        label: row.label ?? null,
        brandSlug: brand?.slug ?? null,
        modelSlug: model?.slug ?? null,
        generationSlug: generation?.slug ?? null,
        engineSlug: engine?.slug ?? null,
        brandName: brand?.name ?? null,
        modelName: model?.name ?? null,
        generationName: generation?.name ?? null,
        generationYears: generation
          ? { from: generation.yearFrom, to: generation.yearTo ?? null }
          : null,
        engineName: engine?.name ?? null,
        engineCodes: engine?.codes ?? [],
        vin: row.vin ?? null,
        plate: row.plate ?? null,
        note: row.note ?? null,
      });
    }
    return out;
  },
});

export const addSavedVehicle = userMutation({
  args: {
    brandSlug: v.string(),
    modelSlug: v.optional(v.string()),
    generationSlug: v.optional(v.string()),
    engineSlug: v.optional(v.string()),
    label: v.optional(v.string()),
    vin: v.optional(v.string()),
    plate: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("savedVehicles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedVehicles")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .take(MAX_SAVED_VEHICLES);
    if (existing.length >= MAX_SAVED_VEHICLES) invalid("Najviše 30 sačuvanih vozila.");
    const brand = await ctx.db
      .query("vehicleBrands")
      .withIndex("by_slug", (q) => q.eq("slug", args.brandSlug))
      .unique();
    if (!brand) return notFound("Marka ne postoji.");
    const model = args.modelSlug
      ? await ctx.db
          .query("vehicleModels")
          .withIndex("by_brandId_and_slug", (q) =>
            q.eq("brandId", brand._id).eq("slug", args.modelSlug!),
          )
          .unique()
      : null;
    const generation =
      model && args.generationSlug
        ? await ctx.db
            .query("vehicleGenerations")
            .withIndex("by_modelId_and_slug", (q) =>
              q.eq("modelId", model._id).eq("slug", args.generationSlug!),
            )
            .unique()
        : null;
    const engine =
      generation && args.engineSlug
        ? await ctx.db
            .query("engines")
            .withIndex("by_slug", (q) => q.eq("slug", args.engineSlug!))
            .unique()
        : null;
    let vin: string | undefined;
    if (args.vin?.trim()) {
      vin = normalizeVin(args.vin);
      if (!validateVin(vin).valid) invalid("Broj šasije ima 17 znakova (bez slova I, O i Q).", "vin");
    }
    const same = existing.find(
      (row) =>
        row.brandId === brand._id &&
        row.modelId === model?._id &&
        row.generationId === generation?._id &&
        row.engineId === engine?._id &&
        (row.vin ?? undefined) === vin,
    );
    if (same) return same._id;
    return await ctx.db.insert("savedVehicles", {
      userId: ctx.viewer.userId,
      brandId: brand._id,
      ...(model ? { modelId: model._id } : {}),
      ...(generation ? { generationId: generation._id } : {}),
      ...(engine ? { engineId: engine._id } : {}),
      ...(args.label?.trim() ? { label: args.label.trim().slice(0, 60) } : {}),
      ...(vin ? { vin } : {}),
      ...(args.plate?.trim() ? { plate: args.plate.trim().toUpperCase().slice(0, 16) } : {}),
      ...(args.note?.trim() ? { note: args.note.trim().slice(0, 200) } : {}),
    });
  },
});

export const removeSavedVehicle = userMutation({
  args: { id: v.id("savedVehicles") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("savedVehicles", id);
    if (!row || row.userId !== ctx.viewer.userId) return notFound("Vozilo nije pronađeno.");
    await ctx.db.delete("savedVehicles", id);
    return null;
  },
});

export const updateSavedVehicle = userMutation({
  args: {
    id: v.id("savedVehicles"),
    label: v.optional(v.string()),
    vin: v.optional(v.string()),
    plate: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...args }) => {
    const row = await ctx.db.get("savedVehicles", id);
    if (!row || row.userId !== ctx.viewer.userId) return notFound("Vozilo nije pronađeno.");
    let vin: string | undefined;
    if (args.vin?.trim()) {
      vin = normalizeVin(args.vin);
      if (!validateVin(vin).valid) invalid("Broj šasije ima 17 znakova (bez slova I, O i Q).", "vin");
    }
    const text = (value: string | undefined, max: number) =>
      value === undefined ? undefined : value.trim().slice(0, max) || undefined;
    await ctx.db.patch("savedVehicles", id, {
      ...(args.label !== undefined ? { label: text(args.label, 60) } : {}),
      ...(args.vin !== undefined ? { vin } : {}),
      ...(args.plate !== undefined ? { plate: text(args.plate, 16)?.toUpperCase() } : {}),
      ...(args.note !== undefined ? { note: text(args.note, 200) } : {}),
    });
    return null;
  },
});

// ------------------------------------------------------------------ favorites

const MAX_FAVORITES = 200;

/** Own favorites as product cards with the viewer's price (mechanics: their own). */
export const favorites = userQuery({
  args: {},
  returns: v.array(
    v.object({
      productId: v.id("products"),
      addedAt: v.number(),
      card: productCardV,
      unitPricePara: v.number(),
      discountBp: v.number(),
      listed: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("favorites")
      .withIndex("by_userId_and_productId", (q) => q.eq("userId", ctx.viewer.userId))
      .take(MAX_FAVORITES);
    const pc = await loadPricingContext(ctx, ctx.viewer);
    const cache: CategoryPathCache = new Map();
    const out = [];
    for (const row of rows) {
      const product = await ctx.db.get("products", row.productId);
      if (!product) continue;
      const price = await priceForViewer(ctx, pc, product, cache);
      out.push({
        productId: product._id,
        addedAt: row._creationTime,
        card: await toCard(ctx, product, true),
        unitPricePara: price.yourPricePara ?? product.retailPricePara,
        discountBp: price.discountBp,
        listed: isListed(product),
      });
    }
    return out.sort((a, b) => b.addedAt - a.addedAt);
  },
});

/** Which of the given products are the viewer's favorites (heart state on cards/product). */
export const favoriteIds = userQuery({
  args: { productIds: v.array(v.id("products")) },
  returns: v.array(v.id("products")),
  handler: async (ctx, { productIds }) => {
    if (productIds.length > 60) invalid("Najviše 60 artikala po upitu.");
    const out = [];
    for (const productId of new Set(productIds)) {
      const row = await ctx.db
        .query("favorites")
        .withIndex("by_userId_and_productId", (q) =>
          q.eq("userId", ctx.viewer.userId).eq("productId", productId),
        )
        .first();
      if (row) out.push(productId);
    }
    return out;
  },
});

export const toggleFavorite = userMutation({
  args: { productId: v.id("products") },
  returns: v.object({ favorite: v.boolean() }),
  handler: async (ctx, { productId }) => {
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_userId_and_productId", (q) =>
        q.eq("userId", ctx.viewer.userId).eq("productId", productId),
      )
      .first();
    if (existing) {
      await ctx.db.delete("favorites", existing._id);
      return { favorite: false };
    }
    const product = await ctx.db.get("products", productId);
    if (!product || !isListed(product)) return notFound("Artikal više nije u ponudi.");
    const count = await ctx.db
      .query("favorites")
      .withIndex("by_userId_and_productId", (q) => q.eq("userId", ctx.viewer.userId))
      .take(MAX_FAVORITES);
    if (count.length >= MAX_FAVORITES) invalid("Najviše 200 omiljenih artikala.");
    await ctx.db.insert("favorites", { userId: ctx.viewer.userId, productId });
    return { favorite: true };
  },
});
