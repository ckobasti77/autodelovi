/**
 * Public SEO read models (SEO-ADS §J3–§J5, §J9, §J10): sitemap sources, feed rows, landing
 * content and internal-linking modules, ad landings and product image lookups. Anonymous
 * projections only — retail prices follow `flags.publicPrices`, never a role price.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { imageToken, productImagePath } from "../lib/seo/images";
import { categoryBySlug, isListed, productCardV, showRetail, toCard } from "./lib/catalog";
import { publicQuery } from "./lib/functions";
import { getSettings } from "./lib/settings";
import { stockStateV } from "./lib/validators";

const MAX_LANDING_ROWS = 8_000;

// ---------------------------------------------------------------------------------------
// Helpers

/** Up to `max` product images as descriptive paths (`/slike/deo/…`). */
async function imagePaths(
  ctx: QueryCtx,
  product: Doc<"products">,
  max: number,
): Promise<{ path: string; alt: string }[]> {
  if (product.imageCount === 0) return [];
  const content = await ctx.db
    .query("productContent")
    .withIndex("by_productId", (q) => q.eq("productId", product._id))
    .unique();
  const out = [];
  for (const [i, img] of (content?.images ?? []).slice(0, max).entries()) {
    const meta = await ctx.db.system.get("_storage", img.storageId);
    if (!meta) continue;
    out.push({
      path: productImagePath(product.slug, i + 1, img.storageId, meta.contentType ?? null),
      alt: img.alt,
    });
  }
  return out;
}

async function brandBySlug(ctx: QueryCtx, slug: string) {
  const brand = await ctx.db
    .query("vehicleBrands")
    .withIndex("by_slug", (q) => q.eq("slug", slug.slice(0, 80)))
    .unique();
  return brand && brand.active ? brand : null;
}

async function modelBySlug(ctx: QueryCtx, brandId: Id<"vehicleBrands">, slug: string) {
  const model = await ctx.db
    .query("vehicleModels")
    .withIndex("by_brandId_and_slug", (q) => q.eq("brandId", brandId).eq("slug", slug.slice(0, 80)))
    .unique();
  return model && model.active ? model : null;
}

const landingLinkV = v.object({
  categorySlug: v.string(),
  categoryName: v.string(),
  brandSlug: v.string(),
  brandName: v.string(),
  modelSlug: v.union(v.string(), v.null()),
  modelName: v.union(v.string(), v.null()),
  productCount: v.number(),
  indexable: v.boolean(),
});

type NameCache = Map<string, string>;

async function landingLink(
  ctx: QueryCtx,
  row: Doc<"landingStats">,
  names: NameCache,
): Promise<{
  categorySlug: string;
  categoryName: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string | null;
  modelName: string | null;
  productCount: number;
  indexable: boolean;
} | null> {
  const cached = async (
    id: string,
    load: () => Promise<{ name: string; active: boolean } | null>,
  ) => {
    const hit = names.get(id);
    if (hit !== undefined) return hit;
    const doc = await load();
    const name = doc && doc.active ? doc.name : "";
    names.set(id, name);
    return name;
  };
  const categoryName = await cached(row.categoryId, () => ctx.db.get("categories", row.categoryId));
  const brandName = await cached(row.brandId, () => ctx.db.get("vehicleBrands", row.brandId));
  const modelId = row.modelId;
  const modelName = modelId
    ? await cached(modelId, () => ctx.db.get("vehicleModels", modelId))
    : null;
  if (!categoryName || !brandName || (row.modelId && !modelName)) return null;
  return {
    categorySlug: row.categorySlug,
    categoryName,
    brandSlug: row.brandSlug,
    brandName,
    modelSlug: row.modelSlug ?? null,
    modelName,
    productCount: row.productCount,
    indexable: row.indexable,
  };
}

// ---------------------------------------------------------------------------------------
// Sitemaps

export const sitemapData = publicQuery({
  args: {},
  returns: v.object({
    categories: v.array(v.object({ slug: v.string(), updatedAt: v.number() })),
    brands: v.array(v.object({ slug: v.string() })),
    models: v.array(v.object({ brandSlug: v.string(), slug: v.string() })),
    generations: v.array(
      v.object({
        brandSlug: v.string(),
        modelSlug: v.string(),
        slug: v.string(),
        productCount: v.number(),
      }),
    ),
    landings: v.array(
      v.object({
        categorySlug: v.string(),
        brandSlug: v.string(),
        modelSlug: v.union(v.string(), v.null()),
        updatedAt: v.number(),
      }),
    ),
    productCount: v.number(),
    curatedSearches: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const all: Doc<"categories">[] = [];
    for (const kind of ["system", "category", "subcategory"] as const) {
      const rows = await ctx.db
        .query("categories")
        .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", kind))
        .take(500);
      all.push(...rows.filter((c) => c.active));
    }
    // A category is listed when it (or one of its children) has active products; a system
    // hub when any of its categories is.
    const withProducts = new Set<Id<"categories">>();
    let productCount = 0;
    for (const c of all) {
      if (c.kind !== "system" && c.productCount > 0) {
        withProducts.add(c._id);
        productCount += c.productCount;
        if (c.parentId) withProducts.add(c.parentId);
      }
    }
    const systemsWithProducts = new Set(
      all.filter((c) => withProducts.has(c._id)).map((c) => c.systemSlug),
    );
    const categories = all
      .filter((c) =>
        c.kind === "system" ? systemsWithProducts.has(c.slug) : withProducts.has(c._id),
      )
      .map((c) => ({ slug: c.slug, updatedAt: c.updatedAt }));

    const brands: { slug: string }[] = [];
    const models: { brandSlug: string; slug: string }[] = [];
    const generationsById = new Map<
      Id<"vehicleGenerations">,
      { brandSlug: string; modelSlug: string; slug: string }
    >();
    for (const brand of (
      await ctx.db.query("vehicleBrands").withIndex("by_sortOrder").take(50)
    ).filter((b) => b.active)) {
      brands.push({ slug: brand.slug });
      const modelRows = await ctx.db
        .query("vehicleModels")
        .withIndex("by_brandId_and_sortOrder", (q) => q.eq("brandId", brand._id))
        .take(200);
      for (const model of modelRows.filter((m) => m.active)) {
        models.push({ brandSlug: brand.slug, slug: model.slug });
        const gens = await ctx.db
          .query("vehicleGenerations")
          .withIndex("by_modelId_and_yearFrom", (q) => q.eq("modelId", model._id))
          .take(50);
        for (const g of gens.filter((g) => g.active)) {
          generationsById.set(g._id, {
            brandSlug: brand.slug,
            modelSlug: model.slug,
            slug: g.slug,
          });
        }
      }
    }

    // Fitting products per generation = sum over categories of the model rows' counts
    // (every product belongs to exactly one category).
    const landingRows = await ctx.db
      .query("landingStats")
      .withIndex("by_rank")
      .take(MAX_LANDING_ROWS);
    const perGeneration = new Map<Id<"vehicleGenerations">, number>();
    for (const row of landingRows) {
      if (!row.modelId) continue;
      for (const g of row.generationCounts) {
        perGeneration.set(g.generationId, (perGeneration.get(g.generationId) ?? 0) + g.count);
      }
    }
    const minGeneration = settings.seo.landingMin.generationPage;
    const generations = [...generationsById.entries()]
      .map(([id, g]) => ({ ...g, productCount: perGeneration.get(id) ?? 0 }))
      .filter((g) => g.productCount >= minGeneration);

    const landings = landingRows
      .filter((r) => r.indexable)
      .map((r) => ({
        categorySlug: r.categorySlug,
        brandSlug: r.brandSlug,
        modelSlug: r.modelSlug ?? null,
        updatedAt: r.updatedAt,
      }));

    return {
      categories,
      brands,
      models,
      generations,
      landings,
      productCount,
      curatedSearches: settings.seo.curatedSearches ?? [],
    };
  },
});

export const sitemapProducts = publicQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      slug: v.string(),
      lastModified: v.number(),
      listed: v.boolean(),
      images: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("products")
      .withIndex("by_active_and_contentUpdatedAt", (q) => q.eq("active", true))
      .paginate(paginationOpts);
    const page = [];
    for (const p of result.page) {
      const listed = isListed(p);
      page.push({
        slug: p.slug,
        lastModified: p.contentUpdatedAt,
        listed,
        images: listed ? (await imagePaths(ctx, p, 3)).map((i) => i.path) : [],
      });
    }
    return { ...result, page };
  },
});

// ---------------------------------------------------------------------------------------
// Feeds

export const feedProducts = publicQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    pricesPublic: v.boolean(),
    page: v.array(
      v.object({
        sku: v.string(),
        slug: v.string(),
        name: v.string(),
        manufacturerName: v.string(),
        mpn: v.union(v.string(), v.null()),
        ean: v.union(v.string(), v.null()),
        oemPrimary: v.union(v.string(), v.null()),
        pricePara: v.number(),
        stockState: stockStateV,
        allowBackorder: v.boolean(),
        leadTimeDays: v.union(v.number(), v.null()),
        categoryId: v.id("categories"),
        categorySlug: v.string(),
        description: v.union(v.string(), v.null()),
        fitmentSummary: v.union(v.string(), v.null()),
        images: v.array(v.string()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { paginationOpts }) => {
    const settings = await getSettings(ctx);
    const pricesPublic = settings.flags.publicPrices;
    const result = await ctx.db
      .query("products")
      .withIndex("by_active_and_contentUpdatedAt", (q) => q.eq("active", true))
      .paginate(paginationOpts);
    const slugs = new Map<Id<"categories">, string>();
    const page = [];
    if (pricesPublic) {
      for (const p of result.page) {
        if (!isListed(p) || p.retailPricePara <= 0) continue;
        let categorySlug = slugs.get(p.categoryId);
        if (categorySlug === undefined) {
          categorySlug = (await ctx.db.get("categories", p.categoryId))?.slug ?? "";
          slugs.set(p.categoryId, categorySlug);
        }
        const content = await ctx.db
          .query("productContent")
          .withIndex("by_productId", (q) => q.eq("productId", p._id))
          .unique();
        page.push({
          sku: p.sku,
          slug: p.slug,
          name: p.name,
          manufacturerName: p.manufacturerName,
          mpn: p.mpn ?? null,
          ean: p.ean ?? null,
          oemPrimary: p.oemPrimary ?? null,
          pricePara: p.retailPricePara,
          stockState: p.stockState,
          allowBackorder: p.allowBackorder,
          leadTimeDays: p.leadTimeDays ?? null,
          categoryId: p.categoryId,
          categorySlug,
          description: content?.description?.slice(0, 5_000) ?? null,
          fitmentSummary: p.fitmentSummary ?? null,
          images: (await imagePaths(ctx, p, 10)).map((i) => i.path),
        });
      }
    }
    return {
      pricesPublic,
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// ---------------------------------------------------------------------------------------
// Landings (thin-content guard + unique content from data) and internal links

export const landing = publicQuery({
  args: {
    categorySlug: v.string(),
    brandSlug: v.string(),
    modelSlug: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      indexable: v.boolean(),
      productCount: v.number(),
      inStockCount: v.number(),
      price: v.union(v.null(), v.object({ minPara: v.number(), maxPara: v.number() })),
      manufacturerCount: v.number(),
      manufacturers: v.array(v.object({ name: v.string(), count: v.number() })),
      topOems: v.array(v.string()),
      generations: v.array(
        v.object({
          name: v.string(),
          slug: v.string(),
          modelName: v.string(),
          modelSlug: v.string(),
          yearFrom: v.number(),
          yearTo: v.union(v.number(), v.null()),
          count: v.number(),
          inStock: v.number(),
        }),
      ),
      engines: v.array(
        v.object({
          generationName: v.string(),
          generationSlug: v.string(),
          engineName: v.string(),
          engineSlug: v.string(),
          engineCodes: v.array(v.string()),
          count: v.number(),
        }),
      ),
      /** Same category, other models of the brand (model landing) or the brand's models. */
      siblings: v.array(landingLinkV),
      /** Same vehicle (brand or model), other categories. */
      otherCategories: v.array(landingLinkV),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const category = await categoryBySlug(ctx, args.categorySlug.slice(0, 80));
    const brand = await brandBySlug(ctx, args.brandSlug);
    if (!category || !category.active || !brand) return null;
    const model = args.modelSlug ? await modelBySlug(ctx, brand._id, args.modelSlug) : null;
    if (args.modelSlug && !model) return null;
    const row = await ctx.db
      .query("landingStats")
      .withIndex("by_categoryId_and_brandId_and_modelId", (q) =>
        q.eq("categoryId", category._id).eq("brandId", brand._id).eq("modelId", model?._id),
      )
      .unique();
    if (!row) return null;
    const settings = await getSettings(ctx);
    const names: NameCache = new Map();

    const generations = [];
    for (const g of row.generationCounts) {
      const gen = await ctx.db.get("vehicleGenerations", g.generationId);
      if (!gen || !gen.active) continue;
      const m = await ctx.db.get("vehicleModels", gen.modelId);
      if (!m || !m.active) continue;
      generations.push({
        name: gen.name,
        slug: gen.slug,
        modelName: m.name,
        modelSlug: m.slug,
        yearFrom: gen.yearFrom,
        yearTo: gen.yearTo ?? null,
        count: g.count,
        inStock: g.inStock,
      });
    }
    const engines = [];
    for (const e of row.engineCounts) {
      const engine = await ctx.db.get("engines", e.engineId);
      const gen = await ctx.db.get("vehicleGenerations", e.generationId);
      if (!engine || !gen || !gen.active) continue;
      engines.push({
        generationName: gen.name,
        generationSlug: gen.slug,
        engineName: engine.name,
        engineSlug: engine.slug,
        engineCodes: engine.codes.slice(0, 4),
        count: e.count,
      });
    }

    // Siblings: same category and brand, other models (model rows only).
    const sameBrand = await ctx.db
      .query("landingStats")
      .withIndex("by_categoryId_and_brandId_and_modelId", (q) =>
        q.eq("categoryId", category._id).eq("brandId", brand._id),
      )
      .take(200);
    const siblings = [];
    for (const r of sameBrand
      .filter((r) => r.modelId && r._id !== row._id)
      .sort((a, b) => Number(b.indexable) - Number(a.indexable) || b.productCount - a.productCount)
      .slice(0, 12)) {
      const link = await landingLink(ctx, r, names);
      if (link) siblings.push(link);
    }
    // Same vehicle, other categories.
    const sameVehicle = await ctx.db
      .query("landingStats")
      .withIndex("by_brandId_and_modelId", (q) =>
        q.eq("brandId", brand._id).eq("modelId", model?._id),
      )
      .take(300);
    const otherCategories = [];
    for (const r of sameVehicle
      .filter((r) => r.categoryId !== category._id)
      .sort((a, b) => Number(b.indexable) - Number(a.indexable) || b.productCount - a.productCount)
      .slice(0, 12)) {
      const link = await landingLink(ctx, r, names);
      if (link) otherCategories.push(link);
    }

    return {
      indexable: row.indexable,
      productCount: row.productCount,
      inStockCount: row.inStockCount,
      price:
        showRetail(settings, ctx.viewer) && row.maxPricePara > 0
          ? { minPara: row.minPricePara, maxPara: row.maxPricePara }
          : null,
      manufacturerCount: row.manufacturerCount,
      manufacturers: row.manufacturers,
      topOems: row.topOems,
      generations,
      engines,
      siblings,
      otherCategories,
      updatedAt: row.updatedAt,
    };
  },
});

/** Indexable landings of one category (category page „Po vozilu“ links), best first. */
export const categoryLandings = publicQuery({
  args: { categorySlug: v.string(), limit: v.optional(v.number()) },
  returns: v.array(landingLinkV),
  handler: async (ctx, { categorySlug, limit }) => {
    const category = await categoryBySlug(ctx, categorySlug.slice(0, 80));
    if (!category || !category.active) return [];
    const rows = await ctx.db
      .query("landingStats")
      .withIndex("by_categoryId_and_brandId_and_modelId", (q) => q.eq("categoryId", category._id))
      .take(1_000);
    const names: NameCache = new Map();
    const out = [];
    for (const r of rows
      .filter((r) => r.indexable)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, Math.min(24, Math.max(1, Math.floor(limit ?? 12))))) {
      const link = await landingLink(ctx, r, names);
      if (link) out.push(link);
    }
    return out;
  },
});

/** Indexable category landings for a vehicle (brand or model hub / generation page). */
export const vehicleLandings = publicQuery({
  args: { brandSlug: v.string(), modelSlug: v.optional(v.string()) },
  returns: v.array(landingLinkV),
  handler: async (ctx, { brandSlug, modelSlug }) => {
    const brand = await brandBySlug(ctx, brandSlug);
    if (!brand) return [];
    const model = modelSlug ? await modelBySlug(ctx, brand._id, modelSlug) : null;
    if (modelSlug && !model) return [];
    const rows = await ctx.db
      .query("landingStats")
      .withIndex("by_brandId_and_modelId", (q) =>
        q.eq("brandId", brand._id).eq("modelId", model?._id),
      )
      .take(500);
    const names: NameCache = new Map();
    const out = [];
    for (const r of rows
      .filter((r) => r.indexable)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 24)) {
      const link = await landingLink(ctx, r, names);
      if (link) out.push(link);
    }
    return out;
  },
});

/** Landings matching a product's category and fitment vehicles (product page links). */
export const productLandings = publicQuery({
  args: { productId: v.id("products") },
  returns: v.array(landingLinkV),
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get("products", productId);
    if (!product || !isListed(product)) return [];
    const fitments = await ctx.db
      .query("fitments")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .take(200);
    const keys = new Map<string, { brandId: Id<"vehicleBrands">; modelId?: Id<"vehicleModels"> }>();
    for (const f of fitments) {
      if (!f.active) continue;
      keys.set(`${f.brandId}|${f.modelId}`, { brandId: f.brandId, modelId: f.modelId });
      keys.set(`${f.brandId}|`, { brandId: f.brandId });
    }
    // Landings exist for the leaf category and, when the leaf has a parent category, for it.
    const rows: Doc<"landingStats">[] = [];
    for (const key of keys.values()) {
      const row = await ctx.db
        .query("landingStats")
        .withIndex("by_categoryId_and_brandId_and_modelId", (q) =>
          q
            .eq("categoryId", product.categoryId)
            .eq("brandId", key.brandId)
            .eq("modelId", key.modelId),
        )
        .unique();
      if (row?.indexable) rows.push(row);
    }
    const names: NameCache = new Map();
    const out = [];
    for (const r of rows
      .sort((a, b) => Number(Boolean(b.modelId)) - Number(Boolean(a.modelId)) || b.rank - a.rank)
      .slice(0, 8)) {
      const link = await landingLink(ctx, r, names);
      if (link) out.push(link);
    }
    return out;
  },
});

// ---------------------------------------------------------------------------------------
// Ads landing `/ponuda/[slug]` (SEO-ADS §J10)

export const adLanding = publicQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      slug: v.string(),
      title: v.string(),
      headline: v.string(),
      subhead: v.union(v.string(), v.null()),
      bodyMd: v.union(v.string(), v.null()),
      indexable: v.boolean(),
      category: v.union(v.null(), v.object({ slug: v.string(), name: v.string() })),
      vehicle: v.union(
        v.null(),
        v.object({
          brandSlug: v.string(),
          modelSlug: v.union(v.string(), v.null()),
          generationSlug: v.union(v.string(), v.null()),
          label: v.string(),
        }),
      ),
      products: v.array(productCardV),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const doc = await ctx.db
      .query("adLandings")
      .withIndex("by_slug", (q) => q.eq("slug", slug.slice(0, 80)))
      .unique();
    if (!doc || !doc.active) return null;
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const category = doc.categoryId ? await ctx.db.get("categories", doc.categoryId) : null;
    const brand = doc.brandId ? await ctx.db.get("vehicleBrands", doc.brandId) : null;
    const model = doc.modelId ? await ctx.db.get("vehicleModels", doc.modelId) : null;
    const generation = doc.generationId
      ? await ctx.db.get("vehicleGenerations", doc.generationId)
      : null;
    const products = [];
    for (const id of doc.productIds.slice(0, 24)) {
      const p = await ctx.db.get("products", id);
      if (p && isListed(p)) products.push(await toCard(ctx, p, retailVisible));
    }
    const vehicleLabel = [brand?.name, generation?.name ?? model?.name].filter(Boolean).join(" ");
    return {
      slug: doc.slug,
      title: doc.title,
      headline: doc.headline,
      subhead: doc.subhead ?? null,
      bodyMd: doc.bodyMd ?? null,
      indexable: doc.indexable,
      category:
        category && category.active && category.kind !== "system"
          ? { slug: category.slug, name: category.name }
          : null,
      vehicle:
        brand && brand.active
          ? {
              brandSlug: brand.slug,
              modelSlug: model?.slug ?? null,
              generationSlug: model && generation ? generation.slug : null,
              label: vehicleLabel,
            }
          : null,
      products,
      updatedAt: doc.updatedAt,
    };
  },
});

// ---------------------------------------------------------------------------------------
// Product photo lookup for `/slike/deo/<file>` (descriptive image URLs)

export const productImage = publicQuery({
  args: { slug: v.string(), index: v.number(), token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ url: v.string(), contentType: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { slug, index, token }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug.slice(0, 120)))
      .unique();
    if (!product || !isListed(product)) return null;
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .unique();
    const img = content?.images[Math.floor(index) - 1];
    if (!img || imageToken(img.storageId) !== token) return null;
    const url = await ctx.storage.getUrl(img.storageId);
    if (!url) return null;
    const meta = await ctx.db.system.get("_storage", img.storageId);
    return { url, contentType: meta?.contentType ?? null };
  },
});
