/**
 * Vehicle picker data: brand → model → generation → engine (docs/DATA-MODEL.md §C3).
 */
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { publicQuery } from "../lib/functions";
import { fuelV } from "../lib/validators";

const brandV = v.object({
  _id: v.id("vehicleBrands"),
  name: v.string(),
  slug: v.string(),
  aliases: v.array(v.string()),
  wmi: v.array(v.string()),
});

const modelV = v.object({
  _id: v.id("vehicleModels"),
  brandId: v.id("vehicleBrands"),
  name: v.string(),
  slug: v.string(),
  aliases: v.array(v.string()),
});

const generationV = v.object({
  _id: v.id("vehicleGenerations"),
  brandId: v.id("vehicleBrands"),
  modelId: v.id("vehicleModels"),
  name: v.string(),
  code: v.union(v.string(), v.null()),
  slug: v.string(),
  aliases: v.array(v.string()),
  vinModelCodes: v.array(v.string()),
  yearFrom: v.number(),
  yearTo: v.union(v.number(), v.null()),
  platform: v.union(v.string(), v.null()),
});

const engineV = v.object({
  _id: v.id("engines"),
  name: v.string(),
  slug: v.string(),
  codes: v.array(v.string()),
  fuel: fuelV,
  displacementCc: v.union(v.number(), v.null()),
  powerKw: v.number(),
  powerHp: v.number(),
  yearFrom: v.union(v.number(), v.null()),
  yearTo: v.union(v.number(), v.null()),
});

const toBrand = (b: Doc<"vehicleBrands">) => ({
  _id: b._id,
  name: b.name,
  slug: b.slug,
  aliases: b.aliases,
  wmi: b.wmi,
});
const toModel = (m: Doc<"vehicleModels">) => ({
  _id: m._id,
  brandId: m.brandId,
  name: m.name,
  slug: m.slug,
  aliases: m.aliases,
});
const toGeneration = (g: Doc<"vehicleGenerations">) => ({
  _id: g._id,
  brandId: g.brandId,
  modelId: g.modelId,
  name: g.name,
  code: g.code ?? null,
  slug: g.slug,
  aliases: g.aliases,
  vinModelCodes: g.vinModelCodes,
  yearFrom: g.yearFrom,
  yearTo: g.yearTo ?? null,
  platform: g.platform ?? null,
});

export const brands = publicQuery({
  args: {},
  returns: v.array(brandV),
  handler: async (ctx) => {
    const rows = await ctx.db.query("vehicleBrands").withIndex("by_sortOrder").take(50);
    return rows.filter((b) => b.active).map(toBrand);
  },
});

export const models = publicQuery({
  args: { brandSlug: v.string() },
  returns: v.array(modelV),
  handler: async (ctx, { brandSlug }) => {
    const brand = await ctx.db
      .query("vehicleBrands")
      .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
      .unique();
    if (!brand || !brand.active) return [];
    const rows = await ctx.db
      .query("vehicleModels")
      .withIndex("by_brandId_and_sortOrder", (q) => q.eq("brandId", brand._id))
      .take(200);
    return rows.filter((m) => m.active).map(toModel);
  },
});

export const generations = publicQuery({
  args: { modelId: v.id("vehicleModels") },
  returns: v.array(generationV),
  handler: async (ctx, { modelId }) => {
    const rows = await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_modelId_and_yearFrom", (q) => q.eq("modelId", modelId))
      .take(50);
    return rows.filter((g) => g.active).map(toGeneration);
  },
});

export const engines = publicQuery({
  args: { generationId: v.id("vehicleGenerations") },
  returns: v.array(engineV),
  handler: async (ctx, { generationId }) => {
    const links = await ctx.db
      .query("generationEngines")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .take(100);
    const out = [];
    for (const link of links) {
      const engine = await ctx.db.get("engines", link.engineId);
      if (!engine) continue;
      out.push({
        _id: engine._id,
        name: engine.name,
        slug: engine.slug,
        codes: engine.codes,
        fuel: engine.fuel,
        displacementCc: engine.displacementCc ?? null,
        powerKw: engine.powerKw,
        powerHp: engine.powerHp,
        yearFrom: link.yearFrom ?? null,
        yearTo: link.yearTo ?? null,
      });
    }
    return out.sort((a, b) => a.fuel.localeCompare(b.fuel) || a.powerKw - b.powerKw);
  },
});

/** Resolves URL slugs (`?marka=&model=&generacija=&motor=`) to ids and a label. */
export const resolve = publicQuery({
  args: {
    brandSlug: v.string(),
    modelSlug: v.optional(v.string()),
    generationSlug: v.optional(v.string()),
    engineSlug: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      brand: brandV,
      model: v.union(modelV, v.null()),
      generation: v.union(generationV, v.null()),
      engine: v.union(
        v.object({
          _id: v.id("engines"),
          name: v.string(),
          slug: v.string(),
          codes: v.array(v.string()),
        }),
        v.null(),
      ),
      label: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const brand = await ctx.db
      .query("vehicleBrands")
      .withIndex("by_slug", (q) => q.eq("slug", args.brandSlug))
      .unique();
    if (!brand || !brand.active) return null;
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
    let engine: Doc<"engines"> | null = null;
    if (generation && args.engineSlug) {
      const candidate = await ctx.db
        .query("engines")
        .withIndex("by_slug", (q) => q.eq("slug", args.engineSlug!))
        .unique();
      if (candidate) {
        const link = await ctx.db
          .query("generationEngines")
          .withIndex("by_generationId_and_engineId", (q) =>
            q.eq("generationId", generation._id).eq("engineId", candidate._id),
          )
          .first();
        engine = link ? candidate : null;
      }
    }
    const label = [brand.name, generation?.name ?? model?.name, engine?.name]
      .filter(Boolean)
      .join(" ");
    return {
      brand: toBrand(brand),
      model: model ? toModel(model) : null,
      generation: generation ? toGeneration(generation) : null,
      engine: engine
        ? { _id: engine._id, name: engine.name, slug: engine.slug, codes: engine.codes }
        : null,
      label,
    };
  },
});

/**
 * The whole vehicle tree for the hubs (`/vozila…`) and the picker's search: brands → models →
 * generations (reference data, a few hundred rows, cached by Next for an hour).
 */
export const tree = publicQuery({
  args: {},
  returns: v.array(
    v.object({
      brand: brandV,
      models: v.array(v.object({ model: modelV, generations: v.array(generationV) })),
    }),
  ),
  handler: async (ctx) => {
    const brandRows = (await ctx.db.query("vehicleBrands").withIndex("by_sortOrder").take(50)).filter(
      (b) => b.active,
    );
    const out = [];
    for (const brand of brandRows) {
      const models = (
        await ctx.db
          .query("vehicleModels")
          .withIndex("by_brandId_and_sortOrder", (q) => q.eq("brandId", brand._id))
          .take(200)
      ).filter((m) => m.active);
      const withGenerations = [];
      for (const model of models) {
        const generations = (
          await ctx.db
            .query("vehicleGenerations")
            .withIndex("by_modelId_and_yearFrom", (q) => q.eq("modelId", model._id))
            .take(50)
        ).filter((g) => g.active);
        withGenerations.push({ model: toModel(model), generations: generations.map(toGeneration) });
      }
      out.push({ brand: toBrand(brand), models: withGenerations });
    }
    return out;
  },
});
