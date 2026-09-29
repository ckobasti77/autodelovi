/**
 * Anonymous catalog projections and their `returns` validators (docs/SECURITY.md §D4):
 * an extra field (cost, supplier, another role's price) fails validation instead of leaking.
 */
import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Viewer } from "./authz";
import type { Settings } from "./settingsSchema";
import { qualityV, stockStateV } from "./validators";

export const productCardV = v.object({
  _id: v.id("products"),
  slug: v.string(),
  sku: v.string(),
  name: v.string(),
  categoryId: v.id("categories"),
  systemSlug: v.string(),
  manufacturerId: v.id("manufacturers"),
  manufacturerName: v.string(),
  quality: qualityV,
  oemPrimary: v.union(v.string(), v.null()),
  /** Retail incl. PDV; null when prices are hidden for anonymous visitors. */
  retailPricePara: v.union(v.number(), v.null()),
  stockState: stockStateV,
  stockQty: v.number(),
  leadTimeDays: v.union(v.number(), v.null()),
  allowBackorder: v.boolean(),
  universal: v.boolean(),
  fitmentSummary: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  isDemo: v.boolean(),
});
export type ProductCard = Infer<typeof productCardV>;

/** Retail is shown to everyone unless the owner hid public prices (then signed-in only). */
export function showRetail(settings: Settings, viewer: Viewer | null): boolean {
  return settings.flags.publicPrices || viewer !== null;
}

export async function imageUrl(
  ctx: QueryCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<string | null> {
  return storageId ? await ctx.storage.getUrl(storageId) : null;
}

export async function toCard(
  ctx: QueryCtx,
  p: Doc<"products">,
  retailVisible: boolean,
): Promise<ProductCard> {
  return {
    _id: p._id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    systemSlug: p.systemSlug,
    manufacturerId: p.manufacturerId,
    manufacturerName: p.manufacturerName,
    quality: p.quality,
    oemPrimary: p.oemPrimary ?? null,
    retailPricePara: retailVisible ? p.retailPricePara : null,
    stockState: p.stockState,
    stockQty: p.stockQty,
    leadTimeDays: p.leadTimeDays ?? null,
    allowBackorder: p.allowBackorder,
    universal: p.universal,
    fitmentSummary: p.fitmentSummary ?? null,
    imageUrl: await imageUrl(ctx, p.primaryImageId),
    isDemo: p.isDemo,
  };
}

/** Listed = active and not soft-deleted. */
export function isListed(p: Doc<"products">): boolean {
  return p.active && p.deletedAt === undefined;
}

export const categorySummaryV = v.object({
  _id: v.id("categories"),
  slug: v.string(),
  name: v.string(),
  kind: v.union(v.literal("system"), v.literal("category"), v.literal("subcategory")),
  parentId: v.union(v.id("categories"), v.null()),
  systemSlug: v.string(),
  partKey: v.union(v.string(), v.null()),
  sortOrder: v.number(),
  productCount: v.number(),
  inStockCount: v.number(),
  thumbnailPath: v.union(v.string(), v.null()),
});
export type CategorySummary = Infer<typeof categorySummaryV>;

export function toCategorySummary(c: Doc<"categories">): CategorySummary {
  return {
    _id: c._id,
    slug: c.slug,
    name: c.name,
    kind: c.kind,
    parentId: c.parentId ?? null,
    systemSlug: c.systemSlug,
    partKey: c.partKey ?? null,
    sortOrder: c.sortOrder,
    productCount: c.productCount,
    inStockCount: c.inStockCount,
    thumbnailPath: c.thumbnailPath ?? null,
  };
}

export async function categoryBySlug(
  ctx: QueryCtx,
  slug: string,
): Promise<Doc<"categories"> | null> {
  return await ctx.db
    .query("categories")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

/** Leaf ids for listing: the category itself, or its (≤ 10) active children. */
export async function leafCategoryIds(
  ctx: QueryCtx,
  category: Doc<"categories">,
): Promise<Id<"categories">[]> {
  const children = await ctx.db
    .query("categories")
    .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", category._id))
    .take(20);
  const active = children.filter((c) => c.active);
  return active.length > 0 ? active.map((c) => c._id) : [category._id];
}

export const vehicleFilterV = v.object({
  brandId: v.optional(v.id("vehicleBrands")),
  modelId: v.optional(v.id("vehicleModels")),
  generationId: v.optional(v.id("vehicleGenerations")),
  engineId: v.optional(v.id("engines")),
  year: v.optional(v.number()),
});
export type VehicleFilter = Infer<typeof vehicleFilterV>;

export const fitStatusV = v.union(
  v.literal("fits"),
  v.literal("generation_only"),
  v.literal("universal"),
  v.literal("unknown"),
);
