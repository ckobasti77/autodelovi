/**
 * Public product read models (docs/ARCHITECTURE.md §E2, §E9). Every query returns an
 * anonymous projection — no cost, supplier or role price — except `partPanel` and
 * `liveState`, which add `yourPricePara` for the authenticated approved mechanic only.
 */
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { FIT_RANK, fitStatus, type FitStatus } from "../../lib/domain/fitment";
import { STOCK_STATE_RANK, isAvailableNow } from "../../lib/domain/stock";
import { productImagePath } from "../../lib/seo/images";
import {
  categoryBySlug,
  categorySummaryV,
  fitStatusV,
  imageUrl,
  isListed,
  leafCategoryIds,
  productCardV,
  showRetail,
  toCard,
  toCategorySummary,
  vehicleFilterV,
  type VehicleFilter,
} from "../lib/catalog";
import { invalid } from "../lib/errors";
import { publicQuery } from "../lib/functions";
import { loadPricingContext, priceForViewer, type CategoryPathCache } from "../lib/pricing";
import { getSettings } from "../lib/settings";
import { qualityV, stockStateV, type Quality } from "../lib/validators";

const CATEGORY_SCAN_LIMIT = 3_000;
const FITMENT_SCAN_LIMIT = 1_500;
const MAX_PAGE_SIZE = 60;

type SortKey = "popular" | "price_asc" | "price_desc" | "new";

const sortV = v.union(
  v.literal("popular"),
  v.literal("price_asc"),
  v.literal("price_desc"),
  v.literal("new"),
);

/** Products of the given leaf categories, optionally restricted to a vehicle. */
async function candidates(
  ctx: QueryCtx,
  leafIds: Id<"categories">[],
  vehicle: VehicleFilter | undefined,
): Promise<{ products: Doc<"products">[]; truncated: boolean }> {
  const byId = new Map<Id<"products">, Doc<"products">>();
  let truncated = false;
  const hasVehicle = vehicle && (vehicle.generationId || vehicle.modelId || vehicle.brandId);

  if (!hasVehicle) {
    const perLeaf = Math.max(100, Math.floor(CATEGORY_SCAN_LIMIT / leafIds.length));
    for (const categoryId of leafIds) {
      const rows = await ctx.db
        .query("products")
        .withIndex("by_categoryId_and_active_and_popularity", (q) =>
          q.eq("categoryId", categoryId).eq("active", true),
        )
        .order("desc")
        .take(perLeaf);
      if (rows.length === perLeaf) truncated = true;
      for (const p of rows) if (isListed(p)) byId.set(p._id, p);
    }
    return { products: [...byId.values()], truncated };
  }

  const perLeaf = Math.max(100, Math.floor(FITMENT_SCAN_LIMIT / leafIds.length));
  for (const categoryId of leafIds) {
    const fitments = vehicle.generationId
      ? await ctx.db
          .query("fitments")
          .withIndex("by_generationId_and_categoryId_and_active", (q) =>
            q
              .eq("generationId", vehicle.generationId!)
              .eq("categoryId", categoryId)
              .eq("active", true),
          )
          .take(perLeaf)
      : vehicle.modelId
        ? await ctx.db
            .query("fitments")
            .withIndex("by_modelId_and_categoryId_and_active", (q) =>
              q.eq("modelId", vehicle.modelId!).eq("categoryId", categoryId).eq("active", true),
            )
            .take(perLeaf)
        : await ctx.db
            .query("fitments")
            .withIndex("by_brandId_and_categoryId_and_active", (q) =>
              q.eq("brandId", vehicle.brandId!).eq("categoryId", categoryId).eq("active", true),
            )
            .take(perLeaf);
    if (fitments.length === perLeaf) truncated = true;
    for (const f of fitments) {
      if (vehicle.engineId && f.engineId && f.engineId !== vehicle.engineId) continue;
      if (vehicle.year !== undefined) {
        if (f.yearFrom !== undefined && vehicle.year < f.yearFrom) continue;
        if (f.yearTo !== undefined && vehicle.year > f.yearTo) continue;
      }
      if (byId.has(f.productId)) continue;
      const p = await ctx.db.get("products", f.productId);
      if (p && isListed(p)) byId.set(p._id, p);
    }
    const universal = await ctx.db
      .query("products")
      .withIndex("by_categoryId_and_universal_and_active", (q) =>
        q.eq("categoryId", categoryId).eq("universal", true).eq("active", true),
      )
      .take(200);
    for (const p of universal) if (isListed(p)) byId.set(p._id, p);
  }
  return { products: [...byId.values()], truncated };
}

function sortProducts(products: Doc<"products">[], sort: SortKey): Doc<"products">[] {
  const byStock = (a: Doc<"products">, b: Doc<"products">) =>
    STOCK_STATE_RANK[a.stockState] - STOCK_STATE_RANK[b.stockState];
  const copy = [...products];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.retailPricePara - b.retailPricePara || byStock(a, b));
    case "price_desc":
      return copy.sort((a, b) => b.retailPricePara - a.retailPricePara || byStock(a, b));
    case "new":
      return copy.sort((a, b) => b._creationTime - a._creationTime);
    case "popular":
      return copy.sort(
        (a, b) =>
          Number(isAvailableNow(b.stockState)) - Number(isAvailableNow(a.stockState)) ||
          b.popularity - a.popularity ||
          a.name.localeCompare(b.name),
      );
  }
}

type Filters = {
  manufacturerIds?: Id<"manufacturers">[];
  qualities?: Quality[];
  inStockOnly: boolean;
  priceMinPara?: number;
  priceMaxPara?: number;
};

type Dimension = "manufacturer" | "quality" | "availability" | "price";

function matches(p: Doc<"products">, f: Filters, skip?: Dimension): boolean {
  if (
    skip !== "manufacturer" &&
    f.manufacturerIds?.length &&
    !f.manufacturerIds.includes(p.manufacturerId)
  ) {
    return false;
  }
  if (skip !== "quality" && f.qualities?.length && !f.qualities.includes(p.quality)) return false;
  if (skip !== "availability" && f.inStockOnly && !isAvailableNow(p.stockState)) return false;
  if (skip !== "price") {
    if (f.priceMinPara !== undefined && p.retailPricePara < f.priceMinPara) return false;
    if (f.priceMaxPara !== undefined && p.retailPricePara > f.priceMaxPara) return false;
  }
  return true;
}

export const listByCategory = publicQuery({
  args: {
    categorySlug: v.string(),
    vehicle: v.optional(vehicleFilterV),
    manufacturerIds: v.optional(v.array(v.id("manufacturers"))),
    qualities: v.optional(v.array(qualityV)),
    availability: v.optional(v.union(v.literal("all"), v.literal("in_stock"))),
    priceMinPara: v.optional(v.number()),
    priceMaxPara: v.optional(v.number()),
    sort: v.optional(sortV),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      category: categorySummaryV,
      items: v.array(productCardV),
      total: v.number(),
      page: v.number(),
      pageSize: v.number(),
      pageCount: v.number(),
      truncated: v.boolean(),
      facets: v.object({
        manufacturers: v.array(
          v.object({ id: v.id("manufacturers"), name: v.string(), count: v.number() }),
        ),
        qualities: v.array(v.object({ quality: qualityV, count: v.number() })),
        inStockCount: v.number(),
        allCount: v.number(),
        price: v.union(v.null(), v.object({ minPara: v.number(), maxPara: v.number() })),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    if ((args.manufacturerIds?.length ?? 0) > 30) invalid("Previše proizvođača u filteru.");
    const category = await categoryBySlug(ctx, args.categorySlug.slice(0, 80));
    if (!category || !category.active || category.kind === "system") return null;
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const leafIds = await leafCategoryIds(ctx, category);
    const { products, truncated } = await candidates(ctx, leafIds, args.vehicle);

    const filters: Filters = {
      ...(args.manufacturerIds ? { manufacturerIds: args.manufacturerIds } : {}),
      ...(args.qualities ? { qualities: args.qualities } : {}),
      inStockOnly: args.availability === "in_stock",
      ...(args.priceMinPara !== undefined ? { priceMinPara: args.priceMinPara } : {}),
      ...(args.priceMaxPara !== undefined ? { priceMaxPara: args.priceMaxPara } : {}),
    };

    const manufacturerCounts = new Map<Id<"manufacturers">, { name: string; count: number }>();
    const qualityCounts = new Map<Quality, number>();
    let inStockCount = 0;
    let allCount = 0;
    let minPara = Number.POSITIVE_INFINITY;
    let maxPara = 0;
    const filtered: Doc<"products">[] = [];
    for (const p of products) {
      if (matches(p, filters, "manufacturer")) {
        const entry = manufacturerCounts.get(p.manufacturerId) ?? {
          name: p.manufacturerName,
          count: 0,
        };
        entry.count++;
        manufacturerCounts.set(p.manufacturerId, entry);
      }
      if (matches(p, filters, "quality"))
        qualityCounts.set(p.quality, (qualityCounts.get(p.quality) ?? 0) + 1);
      if (matches(p, filters, "availability")) {
        allCount++;
        if (isAvailableNow(p.stockState)) inStockCount++;
      }
      if (matches(p, filters, "price")) {
        minPara = Math.min(minPara, p.retailPricePara);
        maxPara = Math.max(maxPara, p.retailPricePara);
      }
      if (matches(p, filters)) filtered.push(p);
    }

    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(args.pageSize ?? 24)));
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Math.floor(args.page ?? 1)));
    const sorted = sortProducts(filtered, args.sort ?? "popular");
    const slice = sorted.slice((page - 1) * pageSize, page * pageSize);
    const items = [];
    for (const p of slice) items.push(await toCard(ctx, p, retailVisible));

    return {
      category: toCategorySummary(category),
      items,
      total: filtered.length,
      page,
      pageSize,
      pageCount,
      truncated,
      facets: {
        manufacturers: [...manufacturerCounts.entries()]
          .map(([id, e]) => ({ id, name: e.name, count: e.count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        qualities: [...qualityCounts.entries()].map(([quality, count]) => ({ quality, count })),
        inStockCount,
        allCount,
        price: retailVisible && Number.isFinite(minPara) ? { minPara, maxPara } : null,
      },
    };
  },
});

const fitmentRowV = v.object({
  brandName: v.string(),
  modelName: v.string(),
  generationName: v.string(),
  generationSlug: v.string(),
  generationId: v.id("vehicleGenerations"),
  engineName: v.union(v.string(), v.null()),
  engineSlug: v.union(v.string(), v.null()),
  engineCodes: v.array(v.string()),
  engineId: v.union(v.id("engines"), v.null()),
  yearFrom: v.union(v.number(), v.null()),
  yearTo: v.union(v.number(), v.null()),
  note: v.union(v.string(), v.null()),
});

export const bySlug = publicQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      product: productCardV,
      mpn: v.union(v.string(), v.null()),
      ean: v.union(v.string(), v.null()),
      description: v.union(v.string(), v.null()),
      notes: v.union(v.string(), v.null()),
      specs: v.array(
        v.object({ label: v.string(), value: v.string(), unit: v.optional(v.string()) }),
      ),
      oemNumbers: v.array(
        v.object({ raw: v.string(), normalized: v.string(), brand: v.optional(v.string()) }),
      ),
      crossNumbers: v.array(
        v.object({ manufacturer: v.string(), raw: v.string(), normalized: v.string() }),
      ),
      images: v.array(
        v.object({
          url: v.union(v.string(), v.null()),
          /** Descriptive URL `/slike/deo/<slug>-<n>-<v>.<ext>` (image SEO). */
          path: v.string(),
          alt: v.string(),
          width: v.number(),
          height: v.number(),
        }),
      ),
      seoTitle: v.union(v.string(), v.null()),
      seoDescription: v.union(v.string(), v.null()),
      warrantyMonths: v.union(v.number(), v.null()),
      weightGrams: v.union(v.number(), v.null()),
      category: categorySummaryV,
      fitments: v.array(fitmentRowV),
      contentUpdatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug.slice(0, 120)))
      .unique();
    if (!product || !isListed(product)) return null;
    const category = await ctx.db.get("categories", product.categoryId);
    if (!category) return null;
    const settings = await getSettings(ctx);
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .unique();
    const fitments = await ctx.db
      .query("fitments")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .take(200);
    const names = new Map<string, string>();
    const nameOf = async (
      table: "vehicleBrands" | "vehicleModels",
      id: Id<"vehicleBrands"> | Id<"vehicleModels">,
    ) => {
      const hit = names.get(id);
      if (hit) return hit;
      const doc =
        table === "vehicleBrands"
          ? await ctx.db.get("vehicleBrands", id as Id<"vehicleBrands">)
          : await ctx.db.get("vehicleModels", id as Id<"vehicleModels">);
      const name = doc?.name ?? "";
      names.set(id, name);
      return name;
    };
    const fitmentRows = [];
    for (const f of fitments) {
      const generation = await ctx.db.get("vehicleGenerations", f.generationId);
      if (!generation) continue;
      const engine = f.engineId ? await ctx.db.get("engines", f.engineId) : null;
      fitmentRows.push({
        brandName: await nameOf("vehicleBrands", f.brandId),
        modelName: await nameOf("vehicleModels", f.modelId),
        generationName: generation.name,
        generationSlug: generation.slug,
        generationId: generation._id,
        engineName: engine?.name ?? null,
        engineSlug: engine?.slug ?? null,
        engineCodes: engine?.codes ?? [],
        engineId: engine?._id ?? null,
        yearFrom: f.yearFrom ?? generation.yearFrom,
        yearTo: f.yearTo ?? generation.yearTo ?? null,
        note: f.note ?? null,
      });
    }
    const images = [];
    for (const [i, img] of (content?.images ?? []).entries()) {
      const meta = await ctx.db.system.get("_storage", img.storageId);
      images.push({
        url: await imageUrl(ctx, img.storageId),
        path: productImagePath(product.slug, i + 1, img.storageId, meta?.contentType ?? null),
        alt: img.alt,
        width: img.width,
        height: img.height,
      });
    }
    return {
      product: await toCard(ctx, product, showRetail(settings, ctx.viewer)),
      mpn: product.mpn ?? null,
      ean: product.ean ?? null,
      description: content?.description ?? null,
      notes: content?.notes ?? null,
      specs: content?.specs ?? [],
      oemNumbers: content?.oemNumbers ?? [],
      crossNumbers: content?.crossNumbers ?? [],
      images,
      seoTitle: content?.seoTitle ?? null,
      seoDescription: content?.seoDescription ?? null,
      warrantyMonths: content?.warrantyMonths ?? null,
      weightGrams: content?.weightGrams ?? null,
      category: toCategorySummary(category),
      fitments: fitmentRows,
      contentUpdatedAt: product.contentUpdatedAt,
    };
  },
});

export const related = publicQuery({
  args: { productId: v.id("products"), limit: v.optional(v.number()) },
  returns: v.array(productCardV),
  handler: async (ctx, { productId, limit }) => {
    const max = Math.min(12, Math.max(1, Math.floor(limit ?? 8)));
    const product = await ctx.db.get("products", productId);
    if (!product) return [];
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const out: Doc<"products">[] = [];
    const seen = new Set<Id<"products">>([productId]);
    const take = async (categoryId: Id<"categories">, n: number) => {
      const rows = await ctx.db
        .query("products")
        .withIndex("by_categoryId_and_active_and_popularity", (q) =>
          q.eq("categoryId", categoryId).eq("active", true),
        )
        .order("desc")
        .take(n + 1);
      for (const p of rows) {
        if (out.length >= max) return;
        if (!seen.has(p._id) && isListed(p)) {
          seen.add(p._id);
          out.push(p);
        }
      }
    };
    await take(product.categoryId, Math.ceil(max / 2));
    const category = await ctx.db.get("categories", product.categoryId);
    for (const slug of category?.relatedSlugs ?? []) {
      if (out.length >= max) break;
      const rel = await categoryBySlug(ctx, slug);
      if (!rel) continue;
      for (const leafId of await leafCategoryIds(ctx, rel)) {
        if (out.length >= max) break;
        await take(leafId, 2);
      }
    }
    const cards = [];
    for (const p of out) cards.push(await toCard(ctx, p, retailVisible));
    return cards;
  },
});

const pricedCardV = v.object({
  card: productCardV,
  yourPricePara: v.union(v.number(), v.null()),
  fit: v.union(fitStatusV, v.null()),
});

/**
 * 3D part panel (contract F8, DESIGN-SYSTEM §9.10). With a vehicle generation: parts that fit
 * (exact, universal or generation-only) come first, unconfirmed ones last (`unmatched` counts
 * them for the notice); inside each group in stock first, then fit rank, then popularity.
 * Role-aware price for the viewer.
 */
export const partPanel = publicQuery({
  args: {
    categorySlug: v.string(),
    vehicle: v.optional(vehicleFilterV),
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      category: categorySummaryV,
      items: v.array(pricedCardV),
      total: v.number(),
      unmatched: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const category = await categoryBySlug(ctx, args.categorySlug.slice(0, 80));
    if (!category || !category.active || category.kind === "system") return null;
    const max = Math.min(24, Math.max(1, Math.floor(args.limit ?? 12)));
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const leafIds = await leafCategoryIds(ctx, category);
    const { products } = await candidates(ctx, leafIds, undefined);
    const generationId = args.vehicle?.generationId;

    // Fitments of the selected generation in these categories (one index range per leaf).
    const fitRows = new Map<Id<"products">, Doc<"fitments">[]>();
    if (generationId) {
      for (const categoryId of leafIds) {
        const rows = await ctx.db
          .query("fitments")
          .withIndex("by_generationId_and_categoryId_and_active", (q) =>
            q.eq("generationId", generationId).eq("categoryId", categoryId).eq("active", true),
          )
          .take(FITMENT_SCAN_LIMIT);
        for (const row of rows)
          fitRows.set(row.productId, [...(fitRows.get(row.productId) ?? []), row]);
      }
    }
    const selected = {
      ...(generationId ? { generationId } : {}),
      ...(args.vehicle?.engineId ? { engineId: args.vehicle.engineId } : {}),
      ...(args.vehicle?.year !== undefined ? { year: args.vehicle.year } : {}),
    };
    const withFit: Array<{ p: Doc<"products">; fit: FitStatus | null }> = products.map((p) => ({
      p,
      fit: generationId ? fitStatus(fitRows.get(p._id) ?? [], selected, p.universal) : null,
    }));
    const unconfirmed = (fit: FitStatus | null) => (fit === "unknown" ? 1 : 0);
    withFit.sort(
      (a, b) =>
        unconfirmed(a.fit) - unconfirmed(b.fit) ||
        Number(isAvailableNow(b.p.stockState)) - Number(isAvailableNow(a.p.stockState)) ||
        (a.fit && b.fit ? FIT_RANK[a.fit] - FIT_RANK[b.fit] : 0) ||
        b.p.popularity - a.p.popularity,
    );
    const unmatched = withFit.filter((row) => row.fit === "unknown").length;
    const pc = await loadPricingContext(ctx, ctx.viewer);
    const cache: CategoryPathCache = new Map();
    const items = [];
    for (const { p, fit } of withFit.slice(0, max)) {
      const price = await priceForViewer(ctx, pc, p, cache);
      items.push({
        card: await toCard(ctx, p, retailVisible),
        yourPricePara: price.yourPricePara,
        fit,
      });
    }
    return { category: toCategorySummary(category), items, total: products.length, unmatched };
  },
});

/** Live stock + the viewer's price for every card on a page (one subscription). */
export const liveState = publicQuery({
  args: { productIds: v.array(v.id("products")) },
  returns: v.array(
    v.object({
      productId: v.id("products"),
      active: v.boolean(),
      stockState: stockStateV,
      stockQty: v.number(),
      retailPricePara: v.union(v.number(), v.null()),
      yourPricePara: v.union(v.number(), v.null()),
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
        active: isListed(p),
        stockState: p.stockState,
        stockQty: p.stockQty,
        retailPricePara: retailVisible ? p.retailPricePara : null,
        yourPricePara: price.yourPricePara,
      });
    }
    return out;
  },
});

const VEHICLE_FITMENT_LIMIT = 3_000;
const VEHICLE_HYDRATE_LIMIT = 400;

/**
 * Vehicle page (`/vozila/[marka]/[model]/[generacija]`, ARCHITECTURE §E9): fitting products of
 * one generation (optionally one engine) counted per category, plus the most useful few
 * (available first, then popularity). Universal parts are not counted — they fit everything.
 */
export const forVehicle = publicQuery({
  args: {
    generationId: v.id("vehicleGenerations"),
    engineId: v.optional(v.id("engines")),
    topLimit: v.optional(v.number()),
  },
  returns: v.object({
    total: v.number(),
    truncated: v.boolean(),
    categories: v.array(v.object({ category: categorySummaryV, count: v.number() })),
    top: v.array(productCardV),
  }),
  handler: async (ctx, { generationId, engineId, topLimit }) => {
    const fitments = await ctx.db
      .query("fitments")
      .withIndex("by_generationId_and_categoryId_and_active", (q) =>
        q.eq("generationId", generationId),
      )
      .take(VEHICLE_FITMENT_LIMIT);
    const truncated = fitments.length === VEHICLE_FITMENT_LIMIT;
    const byCategory = new Map<Id<"categories">, Set<Id<"products">>>();
    const productIds: Id<"products">[] = [];
    const seen = new Set<Id<"products">>();
    for (const f of fitments) {
      if (!f.active) continue;
      if (engineId && f.engineId && f.engineId !== engineId) continue;
      const set = byCategory.get(f.categoryId) ?? new Set<Id<"products">>();
      set.add(f.productId);
      byCategory.set(f.categoryId, set);
      if (!seen.has(f.productId)) {
        seen.add(f.productId);
        productIds.push(f.productId);
      }
    }
    const categories = [];
    for (const [categoryId, ids] of byCategory) {
      const category = await ctx.db.get("categories", categoryId);
      if (category && category.active) {
        categories.push({ category: toCategorySummary(category), count: ids.size });
      }
    }
    categories.sort((a, b) => a.category.sortOrder - b.category.sortOrder);

    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const hydrated: Doc<"products">[] = [];
    for (const id of productIds.slice(0, VEHICLE_HYDRATE_LIMIT)) {
      const p = await ctx.db.get("products", id);
      if (p && isListed(p)) hydrated.push(p);
    }
    hydrated.sort(
      (a, b) =>
        Number(isAvailableNow(b.stockState)) - Number(isAvailableNow(a.stockState)) ||
        b.popularity - a.popularity,
    );
    const max = Math.min(24, Math.max(0, Math.floor(topLimit ?? 8)));
    const top = [];
    for (const p of hydrated.slice(0, max)) top.push(await toCard(ctx, p, retailVisible));
    return { total: seen.size, truncated, categories, top };
  },
});

/**
 * A product that is no longer sold (inactive or soft-deleted): the page answers 200 with
 * „Artikal više nije u ponudi“ and alternatives instead of a 404 (ROUTES §B1).
 */
export const retired = publicQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      manufacturerName: v.string(),
      oemPrimary: v.union(v.string(), v.null()),
      category: v.union(categorySummaryV, v.null()),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug.slice(0, 120)))
      .unique();
    if (!product || isListed(product)) return null;
    const category = await ctx.db.get("categories", product.categoryId);
    return {
      name: product.name,
      manufacturerName: product.manufacturerName,
      oemPrimary: product.oemPrimary ?? null,
      category: category && category.active ? toCategorySummary(category) : null,
    };
  },
});
