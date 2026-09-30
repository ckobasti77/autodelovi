/**
 * Programmatic landing statistics (SEO-ADS §J4). Every hour `recompute` walks the non-system
 * categories in small chained transactions, aggregates active fitments per (category, brand)
 * and (category, brand, model) into `landingStats`, and `rank` then applies the thin-content
 * guard and the global cap (`lib/seo/landingGuard`). Rows are only written when something
 * changed, so reactive readers are not woken up every hour for nothing.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { isAvailableNow } from "../lib/domain/stock";
import { applyLandingCap, landingRank } from "../lib/seo/landingGuard";
import { isListed, leafCategoryIds } from "./lib/catalog";
import { getSettings } from "./lib/settings";

const CATEGORIES_PER_TRANSACTION = 3;
const FITMENTS_PER_LEAF_AND_BRAND = 6_000;
const MAX_ROWS = 8_000;

type Agg = {
  products: Map<Id<"products">, Doc<"products">>;
  generations: Map<Id<"vehicleGenerations">, Set<Id<"products">>>;
  engines: Map<
    string,
    { generationId: Id<"vehicleGenerations">; engineId: Id<"engines">; ids: Set<Id<"products">> }
  >;
};

const newAgg = (): Agg => ({ products: new Map(), generations: new Map(), engines: new Map() });

type LandingFields = Omit<
  Doc<"landingStats">,
  "_id" | "_creationTime" | "indexable" | "reason" | "dirty" | "updatedAt"
>;

function summarize(
  agg: Agg,
  keys: {
    categoryId: Id<"categories">;
    categorySlug: string;
    brandId: Id<"vehicleBrands">;
    brandSlug: string;
    modelId?: Id<"vehicleModels">;
    modelSlug?: string;
  },
): LandingFields {
  const products = [...agg.products.values()];
  let inStock = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  const makers = new Map<string, number>();
  for (const p of products) {
    if (isAvailableNow(p.stockState)) inStock++;
    if (p.retailPricePara > 0) {
      min = Math.min(min, p.retailPricePara);
      max = Math.max(max, p.retailPricePara);
    }
    makers.set(p.manufacturerName, (makers.get(p.manufacturerName) ?? 0) + 1);
  }
  const byPopularity = [...products].sort((a, b) => b.popularity - a.popularity);
  const topOems: string[] = [];
  for (const p of byPopularity) {
    if (p.oemPrimary && !topOems.includes(p.oemPrimary)) topOems.push(p.oemPrimary);
    if (topOems.length >= 5) break;
  }
  const generationCounts = [...agg.generations.entries()]
    .map(([generationId, ids]) => ({
      generationId,
      count: ids.size,
      inStock: [...ids].filter((id) => {
        const p = agg.products.get(id);
        return p ? isAvailableNow(p.stockState) : false;
      }).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
  const engineCounts = keys.modelId
    ? [...agg.engines.values()]
        .map((e) => ({ generationId: e.generationId, engineId: e.engineId, count: e.ids.size }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
    : [];
  return {
    categoryId: keys.categoryId,
    brandId: keys.brandId,
    ...(keys.modelId ? { modelId: keys.modelId } : {}),
    categorySlug: keys.categorySlug,
    brandSlug: keys.brandSlug,
    ...(keys.modelSlug ? { modelSlug: keys.modelSlug } : {}),
    productCount: products.length,
    inStockCount: inStock,
    minPricePara: Number.isFinite(min) ? min : 0,
    maxPricePara: max,
    manufacturerCount: makers.size,
    manufacturers: [...makers.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "sr"))
      .slice(0, 6),
    topOems,
    generationIds: generationCounts.map((g) => g.generationId),
    generationCounts,
    engineCounts,
    rank: landingRank({ productCount: products.length, inStockCount: inStock }),
  };
}

const rowKey = (brandId: string, modelId?: string) => `${brandId}|${modelId ?? ""}`;

/** Recomputes the landing rows of one category (brand and model level). */
export async function recomputeCategory(
  ctx: MutationCtx,
  categoryId: Id<"categories">,
): Promise<{ rows: number }> {
  const existing = await ctx.db
    .query("landingStats")
    .withIndex("by_categoryId_and_brandId_and_modelId", (q) => q.eq("categoryId", categoryId))
    .take(MAX_ROWS);
  const category = await ctx.db.get("categories", categoryId);
  if (!category || !category.active || category.kind === "system") {
    for (const row of existing) await ctx.db.delete("landingStats", row._id);
    return { rows: 0 };
  }
  const leafIds = await leafCategoryIds(ctx, category);
  const brands = (await ctx.db.query("vehicleBrands").withIndex("by_sortOrder").take(50)).filter(
    (b) => b.active,
  );
  const productCache = new Map<Id<"products">, Doc<"products"> | null>();
  const modelSlugs = new Map<Id<"vehicleModels">, string | null>();
  const computed = new Map<string, LandingFields>();

  for (const brand of brands) {
    const brandAgg = newAgg();
    const models = new Map<Id<"vehicleModels">, Agg>();
    for (const leafId of leafIds) {
      const fitments = await ctx.db
        .query("fitments")
        .withIndex("by_brandId_and_categoryId_and_active", (q) =>
          q.eq("brandId", brand._id).eq("categoryId", leafId).eq("active", true),
        )
        .take(FITMENTS_PER_LEAF_AND_BRAND);
      for (const f of fitments) {
        let product = productCache.get(f.productId);
        if (product === undefined) {
          const doc = await ctx.db.get("products", f.productId);
          product = doc && isListed(doc) ? doc : null;
          productCache.set(f.productId, product);
        }
        if (!product) continue;
        const modelAgg = models.get(f.modelId) ?? newAgg();
        models.set(f.modelId, modelAgg);
        for (const agg of [brandAgg, modelAgg]) {
          agg.products.set(product._id, product);
          const gen = agg.generations.get(f.generationId) ?? new Set();
          gen.add(product._id);
          agg.generations.set(f.generationId, gen);
        }
        if (f.engineId) {
          const key = `${f.generationId}|${f.engineId}`;
          const entry = modelAgg.engines.get(key) ?? {
            generationId: f.generationId,
            engineId: f.engineId,
            ids: new Set<Id<"products">>(),
          };
          entry.ids.add(product._id);
          modelAgg.engines.set(key, entry);
        }
      }
    }
    if (brandAgg.products.size === 0) continue;
    const base = {
      categoryId,
      categorySlug: category.slug,
      brandId: brand._id,
      brandSlug: brand.slug,
    };
    computed.set(rowKey(brand._id), summarize(brandAgg, base));
    for (const [modelId, agg] of models) {
      let slug = modelSlugs.get(modelId);
      if (slug === undefined) {
        const model = await ctx.db.get("vehicleModels", modelId);
        slug = model && model.active ? model.slug : null;
        modelSlugs.set(modelId, slug);
      }
      if (!slug) continue;
      computed.set(
        rowKey(brand._id, modelId),
        summarize(agg, { ...base, modelId, modelSlug: slug }),
      );
    }
  }

  const now = Date.now();
  const seen = new Set<string>();
  for (const row of existing) {
    const key = rowKey(row.brandId, row.modelId);
    const next = computed.get(key);
    if (!next || seen.has(key)) {
      await ctx.db.delete("landingStats", row._id);
      continue;
    }
    seen.add(key);
    if (fingerprint(row) !== fingerprint(next)) {
      await ctx.db.patch("landingStats", row._id, { ...next, dirty: false, updatedAt: now });
    }
  }
  for (const [key, fields] of computed) {
    if (seen.has(key)) continue;
    await ctx.db.insert("landingStats", {
      ...fields,
      indexable: false,
      dirty: false,
      updatedAt: now,
    });
  }
  return { rows: computed.size };
}

/** The derived values of a row; a write happens only when this changes. */
function fingerprint(r: LandingFields): string {
  return JSON.stringify([
    r.categorySlug,
    r.brandSlug,
    r.modelSlug ?? null,
    r.productCount,
    r.inStockCount,
    r.minPricePara,
    r.maxPricePara,
    r.manufacturerCount,
    r.manufacturers,
    r.topOems,
    r.generationCounts,
    r.engineCounts,
    r.rank,
  ]);
}

/** Hourly entry point: queues every non-system category, then the ranking pass. */
export const recompute = internalMutation({
  args: {},
  returns: v.object({ categories: v.number() }),
  handler: async (ctx) => {
    const ids: Id<"categories">[] = [];
    for (const kind of ["category", "subcategory"] as const) {
      const rows = await ctx.db
        .query("categories")
        .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", kind))
        .take(500);
      for (const c of rows) ids.push(c._id);
    }
    await ctx.scheduler.runAfter(0, internal.landings.recomputeBatch, {
      categoryIds: ids,
      index: 0,
    });
    return { categories: ids.length };
  },
});

export const recomputeBatch = internalMutation({
  args: { categoryIds: v.array(v.id("categories")), index: v.number() },
  returns: v.null(),
  handler: async (ctx, { categoryIds, index }) => {
    const end = Math.min(categoryIds.length, index + CATEGORIES_PER_TRANSACTION);
    for (let i = index; i < end; i++) await recomputeCategory(ctx, categoryIds[i]!);
    if (end < categoryIds.length) {
      await ctx.scheduler.runAfter(0, internal.landings.recomputeBatch, {
        categoryIds,
        index: end,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.landings.rank, {});
    }
    return null;
  },
});

/** Applies the guard + cap to every row (sorted by rank) and drops rows of retired categories. */
export const rank = internalMutation({
  args: {},
  returns: v.object({ indexable: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const rows = await ctx.db
      .query("landingStats")
      .withIndex("by_rank")
      .order("desc")
      .take(MAX_ROWS);
    const activeCategory = new Map<Id<"categories">, boolean>();
    const live: Doc<"landingStats">[] = [];
    for (const row of rows) {
      let active = activeCategory.get(row.categoryId);
      if (active === undefined) {
        const c = await ctx.db.get("categories", row.categoryId);
        active = Boolean(c && c.active && c.kind !== "system");
        activeCategory.set(row.categoryId, active);
      }
      if (active) live.push(row);
      else await ctx.db.delete("landingStats", row._id);
    }
    const verdicts = applyLandingCap(
      live.map((row) => ({
        id: row._id,
        indexableBefore: row.indexable,
        reasonBefore: row.reason,
        level: row.modelId ? ("model" as const) : ("brand" as const),
        productCount: row.productCount,
        inStockCount: row.inStockCount,
        manufacturerCount: row.manufacturerCount,
        generationCount: row.generationCounts.length,
      })),
      { brand: settings.seo.landingMin.brand, model: settings.seo.landingMin.model },
      settings.seo.maxIndexableLandings,
    );
    let indexable = 0;
    for (const { row, indexable: ok, reason } of verdicts) {
      if (ok) indexable++;
      const nextReason = reason ?? undefined;
      if (row.indexableBefore !== ok || row.reasonBefore !== nextReason) {
        await ctx.db.patch("landingStats", row.id, { indexable: ok, reason: nextReason });
      }
    }
    return { indexable, total: live.length };
  },
});

/**
 * Demo ads landing (`/ponuda/kocione-plocice-golf`) so the template can be previewed and
 * tested; the owner edits or deletes it in Podešavanja → Oglasne strane. Idempotent.
 */
export const seedAdLandings = internalMutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    const slug = "kocione-plocice-golf";
    const existing = await ctx.db
      .query("adLandings")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) return { created: 0 };
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "kocione-plocice"))
      .unique();
    const brand = await ctx.db
      .query("vehicleBrands")
      .withIndex("by_slug", (q) => q.eq("slug", "volkswagen"))
      .unique();
    const model = brand
      ? await ctx.db
          .query("vehicleModels")
          .withIndex("by_brandId_and_slug", (q) => q.eq("brandId", brand._id).eq("slug", "golf"))
          .unique()
      : null;
    if (!category || !brand || !model) return { created: 0 };
    await ctx.db.insert("adLandings", {
      slug,
      title: "Kočione pločice za VW Golf",
      headline: "Kočione pločice za VW Golf — proverene po OEM broju",
      subhead:
        "Prednje i zadnje pločice za Golf VI, VII i VIII. Pošaljite broj šasije ako niste sigurni koje vam trebaju.",
      categoryId: category._id,
      brandId: brand._id,
      modelId: model._id,
      productIds: [],
      indexable: false,
      active: true,
      updatedAt: Date.now(),
    });
    return { created: 1 };
  },
});
