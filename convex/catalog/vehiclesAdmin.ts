/**
 * Staff vehicle reference editor (`/admin/vozila`): brands → models → generations, engines
 * and generation ↔ engine links. Seeded rows stay editable; slugs of rows already used in
 * URLs are kept unless staff change them explicitly. Every write is audited.
 */
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { slugifySr } from "../../lib/domain/slug";
import { audit } from "../lib/audit";
import { actorOf } from "../lib/authz";
import { invalid, notFound } from "../lib/errors";
import { staffMutation, staffQuery } from "../lib/functions";
import { fuelV } from "../lib/validators";

const list = (text: string | undefined) =>
  (text ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

const yearOk = (y: number | undefined) =>
  y === undefined || (Number.isInteger(y) && y >= 1950 && y <= 2100);

/** Brands with their models (≤ 60 per brand), for the tree column. */
export const tree = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("vehicleBrands"),
      name: v.string(),
      slug: v.string(),
      active: v.boolean(),
      wmi: v.array(v.string()),
      aliases: v.array(v.string()),
      models: v.array(
        v.object({
          _id: v.id("vehicleModels"),
          name: v.string(),
          slug: v.string(),
          active: v.boolean(),
          aliases: v.array(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const brands = await ctx.db.query("vehicleBrands").withIndex("by_sortOrder").take(30);
    const out = [];
    for (const b of brands) {
      const models = await ctx.db
        .query("vehicleModels")
        .withIndex("by_brandId_and_sortOrder", (q) => q.eq("brandId", b._id))
        .take(100);
      out.push({
        _id: b._id,
        name: b.name,
        slug: b.slug,
        active: b.active,
        wmi: b.wmi,
        aliases: b.aliases,
        models: models.map((m) => ({
          _id: m._id,
          name: m.name,
          slug: m.slug,
          active: m.active,
          aliases: m.aliases,
        })),
      });
    }
    return out;
  },
});

/** Generations of a model with their linked engines. */
export const generations = staffQuery({
  args: { modelId: v.id("vehicleModels") },
  returns: v.array(
    v.object({
      _id: v.id("vehicleGenerations"),
      name: v.string(),
      code: v.union(v.string(), v.null()),
      slug: v.string(),
      yearFrom: v.number(),
      yearTo: v.union(v.number(), v.null()),
      platform: v.union(v.string(), v.null()),
      vinModelCodes: v.array(v.string()),
      aliases: v.array(v.string()),
      active: v.boolean(),
      engines: v.array(
        v.object({
          linkId: v.id("generationEngines"),
          engineId: v.id("engines"),
          name: v.string(),
          codes: v.array(v.string()),
          powerKw: v.number(),
          fuel: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { modelId }) => {
    const rows = await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_modelId_and_yearFrom", (q) => q.eq("modelId", modelId))
      .take(60);
    const out = [];
    for (const g of rows) {
      const links = await ctx.db
        .query("generationEngines")
        .withIndex("by_generationId", (q) => q.eq("generationId", g._id))
        .take(80);
      const engines = [];
      for (const link of links) {
        const e = await ctx.db.get("engines", link.engineId);
        if (!e) continue;
        engines.push({
          linkId: link._id,
          engineId: e._id,
          name: e.name,
          codes: e.codes,
          powerKw: e.powerKw,
          fuel: e.fuel,
        });
      }
      out.push({
        _id: g._id,
        name: g.name,
        code: g.code ?? null,
        slug: g.slug,
        yearFrom: g.yearFrom,
        yearTo: g.yearTo ?? null,
        platform: g.platform ?? null,
        vinModelCodes: g.vinModelCodes,
        aliases: g.aliases,
        active: g.active,
        engines,
      });
    }
    return out;
  },
});

export const engines = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("engines"),
      name: v.string(),
      slug: v.string(),
      codes: v.array(v.string()),
      fuel: fuelV,
      displacementCc: v.union(v.number(), v.null()),
      powerKw: v.number(),
      powerHp: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("engines").take(500);
    return rows
      .map((e) => ({
        _id: e._id,
        name: e.name,
        slug: e.slug,
        codes: e.codes,
        fuel: e.fuel,
        displacementCc: e.displacementCc ?? null,
        powerKw: e.powerKw,
        powerHp: e.powerHp,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "sr") || a.powerKw - b.powerKw);
  },
});

async function log(
  ctx: MutationCtx & { viewer: Parameters<typeof actorOf>[0] },
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
) {
  await audit(ctx, { actor: actorOf(ctx.viewer), action, entityType, entityId, summary });
}

export const saveBrand = staffMutation({
  args: {
    brandId: v.optional(v.id("vehicleBrands")),
    name: v.string(),
    wmi: v.optional(v.string()),
    aliases: v.optional(v.string()),
    active: v.boolean(),
  },
  returns: v.id("vehicleBrands"),
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 40);
    if (name.length < 2) invalid("Upišite naziv marke.", "name");
    const wmi = list(args.wmi).map((w) => w.toUpperCase());
    if (wmi.some((w) => !/^[A-HJ-NPR-Z0-9]{3}$/.test(w)))
      invalid("WMI ima tačno 3 znaka (bez I, O, Q).", "wmi");
    const fields = { name, wmi, aliases: list(args.aliases), active: args.active };
    if (args.brandId) {
      const brand = await ctx.db.get("vehicleBrands", args.brandId);
      if (!brand) return notFound("Marka ne postoji.");
      await ctx.db.patch("vehicleBrands", brand._id, fields);
      await log(
        ctx,
        "vehicle.brand_update",
        "vehicleBrand",
        brand._id,
        `Marka „${name}“ izmenjena`,
      );
      return brand._id;
    }
    const slug = slugifySr(name);
    const taken = await ctx.db
      .query("vehicleBrands")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (taken) invalid(`Marka „${name}“ već postoji.`, "name");
    const last = await ctx.db
      .query("vehicleBrands")
      .withIndex("by_sortOrder")
      .order("desc")
      .first();
    const id = await ctx.db.insert("vehicleBrands", {
      ...fields,
      slug,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      source: "admin",
    });
    await log(ctx, "vehicle.brand_create", "vehicleBrand", id, `Nova marka „${name}“`);
    return id;
  },
});

export const saveModel = staffMutation({
  args: {
    modelId: v.optional(v.id("vehicleModels")),
    brandId: v.id("vehicleBrands"),
    name: v.string(),
    aliases: v.optional(v.string()),
    active: v.boolean(),
  },
  returns: v.id("vehicleModels"),
  handler: async (ctx, args) => {
    const brand = await ctx.db.get("vehicleBrands", args.brandId);
    if (!brand) return notFound("Marka ne postoji.");
    const name = args.name.trim().slice(0, 60);
    if (name.length < 1) invalid("Upišite naziv modela.", "name");
    const fields = { name, aliases: list(args.aliases), active: args.active };
    if (args.modelId) {
      const model = await ctx.db.get("vehicleModels", args.modelId);
      if (!model || model.brandId !== brand._id) return notFound("Model ne postoji.");
      await ctx.db.patch("vehicleModels", model._id, fields);
      await log(
        ctx,
        "vehicle.model_update",
        "vehicleModel",
        model._id,
        `Model „${brand.name} ${name}“ izmenjen`,
      );
      return model._id;
    }
    const slug = slugifySr(name);
    const taken = await ctx.db
      .query("vehicleModels")
      .withIndex("by_brandId_and_slug", (q) => q.eq("brandId", brand._id).eq("slug", slug))
      .first();
    if (taken) invalid(`Model „${name}“ već postoji.`, "name");
    const last = await ctx.db
      .query("vehicleModels")
      .withIndex("by_brandId_and_sortOrder", (q) => q.eq("brandId", brand._id))
      .order("desc")
      .first();
    const id = await ctx.db.insert("vehicleModels", {
      ...fields,
      brandId: brand._id,
      slug,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      source: "admin",
    });
    await log(
      ctx,
      "vehicle.model_create",
      "vehicleModel",
      id,
      `Novi model „${brand.name} ${name}“`,
    );
    return id;
  },
});

export const saveGeneration = staffMutation({
  args: {
    generationId: v.optional(v.id("vehicleGenerations")),
    modelId: v.id("vehicleModels"),
    name: v.string(),
    code: v.optional(v.string()),
    yearFrom: v.number(),
    yearTo: v.optional(v.number()),
    platform: v.optional(v.string()),
    vinModelCodes: v.optional(v.string()),
    aliases: v.optional(v.string()),
    active: v.boolean(),
  },
  returns: v.id("vehicleGenerations"),
  handler: async (ctx, args) => {
    const model = await ctx.db.get("vehicleModels", args.modelId);
    if (!model) return notFound("Model ne postoji.");
    const name = args.name.trim().slice(0, 60);
    if (!name) invalid("Upišite naziv generacije.", "name");
    if (!yearOk(args.yearFrom) || !yearOk(args.yearTo))
      invalid("Godina mora biti između 1950 i 2100.", "yearFrom");
    if (args.yearTo !== undefined && args.yearTo < args.yearFrom)
      invalid("Godina „do“ je pre godine „od“.", "yearTo");
    const vinModelCodes = list(args.vinModelCodes).map((c) => c.toUpperCase());
    if (vinModelCodes.some((c) => !/^[A-Z0-9]{2}$/.test(c)))
      invalid("Kod modela u VIN-u ima 2 znaka (pozicije 7–8).", "vinModelCodes");
    const fields = {
      name,
      code: args.code?.trim().slice(0, 20) || undefined,
      yearFrom: args.yearFrom,
      yearTo: args.yearTo,
      platform: args.platform?.trim().slice(0, 20) || undefined,
      vinModelCodes,
      aliases: list(args.aliases),
      active: args.active,
    };
    if (args.generationId) {
      const g = await ctx.db.get("vehicleGenerations", args.generationId);
      if (!g || g.modelId !== model._id) return notFound("Generacija ne postoji.");
      await ctx.db.patch("vehicleGenerations", g._id, fields);
      await log(
        ctx,
        "vehicle.generation_update",
        "vehicleGeneration",
        g._id,
        `Generacija „${model.name} ${name}“ izmenjena`,
      );
      return g._id;
    }
    const brand = await ctx.db.get("vehicleBrands", model.brandId);
    const slug = slugifySr(`${model.name} ${fields.code ?? name}`);
    const taken = await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    const finalSlug = taken ? `${slug}-${args.yearFrom}` : slug;
    const last = await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_modelId_and_yearFrom", (q) => q.eq("modelId", model._id))
      .order("desc")
      .first();
    const id = await ctx.db.insert("vehicleGenerations", {
      ...fields,
      brandId: model.brandId,
      modelId: model._id,
      slug: finalSlug,
      sortOrder: (last?.sortOrder ?? 0) + 10,
      source: "admin",
    });
    await log(
      ctx,
      "vehicle.generation_create",
      "vehicleGeneration",
      id,
      `Nova generacija „${brand?.name ?? ""} ${model.name} ${name}“`,
    );
    return id;
  },
});

export const saveEngine = staffMutation({
  args: {
    engineId: v.optional(v.id("engines")),
    name: v.string(),
    codes: v.optional(v.string()),
    fuel: fuelV,
    displacementCc: v.optional(v.number()),
    powerKw: v.number(),
  },
  returns: v.id("engines"),
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 40);
    if (!name) invalid("Upišite naziv motora (npr. 2.0 TDI).", "name");
    if (!Number.isInteger(args.powerKw) || args.powerKw < 10 || args.powerKw > 600)
      invalid("Snaga 10–600 kW.", "powerKw");
    if (
      args.displacementCc !== undefined &&
      (!Number.isInteger(args.displacementCc) ||
        args.displacementCc < 500 ||
        args.displacementCc > 8_000)
    )
      invalid("Zapremina 500–8000 cm³.", "displacementCc");
    const fields = {
      name,
      codes: list(args.codes).map((c) => c.toUpperCase()),
      fuel: args.fuel,
      displacementCc: args.displacementCc,
      powerKw: args.powerKw,
      powerHp: Math.round(args.powerKw * 1.35962),
    };
    if (args.engineId) {
      const e = await ctx.db.get("engines", args.engineId);
      if (!e) return notFound("Motor ne postoji.");
      await ctx.db.patch("engines", e._id, fields);
      await log(
        ctx,
        "vehicle.engine_update",
        "engine",
        e._id,
        `Motor „${name} ${args.powerKw} kW“ izmenjen`,
      );
      return e._id;
    }
    const slug = slugifySr(`${name} ${args.powerKw}kw`);
    const taken = await ctx.db
      .query("engines")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (taken) invalid(`Motor „${name} ${args.powerKw} kW“ već postoji.`, "name");
    const id = await ctx.db.insert("engines", { ...fields, slug, source: "admin" });
    await log(
      ctx,
      "vehicle.engine_create",
      "engine",
      id,
      `Novi motor „${name} ${args.powerKw} kW“`,
    );
    return id;
  },
});

export const linkEngine = staffMutation({
  args: { generationId: v.id("vehicleGenerations"), engineId: v.id("engines") },
  returns: v.null(),
  handler: async (ctx, { generationId, engineId }) => {
    const g = await ctx.db.get("vehicleGenerations", generationId);
    const e = await ctx.db.get("engines", engineId);
    if (!g || !e) return notFound("Generacija ili motor ne postoji.");
    const existing = await ctx.db
      .query("generationEngines")
      .withIndex("by_generationId_and_engineId", (q) =>
        q.eq("generationId", generationId).eq("engineId", engineId),
      )
      .first();
    if (existing) return null;
    await ctx.db.insert("generationEngines", { generationId, engineId });
    await log(
      ctx,
      "vehicle.engine_link",
      "vehicleGeneration",
      generationId,
      `${g.name}: dodat motor ${e.name} ${e.powerKw} kW`,
    );
    return null;
  },
});

export const unlinkEngine = staffMutation({
  args: { linkId: v.id("generationEngines") },
  returns: v.null(),
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get("generationEngines", linkId);
    if (!link) return null;
    const used = await ctx.db
      .query("fitments")
      .withIndex("by_engineId", (q) => q.eq("engineId", link.engineId))
      .filter((q) => q.eq(q.field("generationId"), link.generationId))
      .first();
    if (used)
      invalid("Motor ima artikle za ovu generaciju — prvo izmenite kompatibilnost tih artikala.");
    const g = await ctx.db.get("vehicleGenerations", link.generationId);
    const e = await ctx.db.get("engines", link.engineId as Id<"engines">);
    await ctx.db.delete("generationEngines", linkId);
    await log(
      ctx,
      "vehicle.engine_unlink",
      "vehicleGeneration",
      link.generationId,
      `${g?.name ?? ""}: uklonjen motor ${e?.name ?? ""}`,
    );
    return null;
  },
});
