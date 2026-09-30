/**
 * Staff product management. All writes go through `productWriter` (the only product
 * write path) and are audited. Cost and supplier data are visible here only.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { normalizeCode } from "../../lib/domain/codes";
import { foldForSearch } from "../../lib/domain/search";
import { audit } from "../lib/audit";
import { actorOf } from "../lib/authz";
import { invalid, notFound } from "../lib/errors";
import { staffMutation, staffQuery } from "../lib/functions";
import { internal } from "../_generated/api";
import {
  applyStockDelta,
  createProduct,
  MAX_PRODUCT_IMAGES,
  setProductImages,
  updateProduct,
  type ProductPatch,
} from "../lib/productWriter";
import { enforceRateLimit } from "../lib/rateLimits";
import { getSettings } from "../lib/settings";
import { actorV, qualityV, stockStateV } from "../lib/validators";

const fitmentInputV = v.object({
  brandId: v.id("vehicleBrands"),
  modelId: v.id("vehicleModels"),
  generationId: v.id("vehicleGenerations"),
  engineId: v.optional(v.id("engines")),
  yearFrom: v.optional(v.number()),
  yearTo: v.optional(v.number()),
  note: v.optional(v.string()),
});

const productFields = {
  sku: v.string(),
  name: v.string(),
  slug: v.optional(v.string()),
  categoryId: v.id("categories"),
  manufacturerId: v.id("manufacturers"),
  quality: v.optional(qualityV),
  mpn: v.optional(v.string()),
  ean: v.optional(v.string()),
  oemNumbers: v.array(v.object({ raw: v.string(), brand: v.optional(v.string()) })),
  crossNumbers: v.array(v.object({ manufacturer: v.string(), raw: v.string() })),
  retailPricePara: v.number(),
  stockQty: v.number(),
  lowStockThreshold: v.optional(v.number()),
  leadTimeDays: v.optional(v.number()),
  allowBackorder: v.boolean(),
  universal: v.boolean(),
  fitments: v.array(fitmentInputV),
  description: v.optional(v.string()),
  specs: v.array(v.object({ label: v.string(), value: v.string(), unit: v.optional(v.string()) })),
  notes: v.optional(v.string()),
  seoTitle: v.optional(v.string()),
  seoDescription: v.optional(v.string()),
  weightGrams: v.optional(v.number()),
  warrantyMonths: v.optional(v.number()),
  costNetPara: v.optional(v.number()),
  supplierName: v.optional(v.string()),
  supplierSku: v.optional(v.string()),
  internalNote: v.optional(v.string()),
  popularity: v.optional(v.number()),
  active: v.boolean(),
};

const clearableFieldV = v.union(
  v.literal("mpn"),
  v.literal("ean"),
  v.literal("lowStockThreshold"),
  v.literal("leadTimeDays"),
  v.literal("description"),
  v.literal("notes"),
  v.literal("seoTitle"),
  v.literal("seoDescription"),
  v.literal("weightGrams"),
  v.literal("warrantyMonths"),
  v.literal("costNetPara"),
  v.literal("supplierName"),
  v.literal("supplierSku"),
  v.literal("internalNote"),
);

const adminRowV = v.object({
  _id: v.id("products"),
  sku: v.string(),
  slug: v.string(),
  name: v.string(),
  manufacturerId: v.id("manufacturers"),
  manufacturerName: v.string(),
  categoryId: v.id("categories"),
  categoryName: v.string(),
  quality: qualityV,
  oemPrimary: v.union(v.string(), v.null()),
  retailPricePara: v.number(),
  stockQty: v.number(),
  stockState: stockStateV,
  leadTimeDays: v.union(v.number(), v.null()),
  thumbUrl: v.union(v.string(), v.null()),
  categoryThumb: v.union(v.string(), v.null()),
  imageCount: v.number(),
  fitmentCount: v.number(),
  active: v.boolean(),
  isDemo: v.boolean(),
  updatedAt: v.number(),
});

type ListCache = Map<Id<"categories">, { name: string; thumb: string | null }>;

async function toAdminRow(ctx: QueryCtx, p: Doc<"products">, cache: ListCache) {
  let category = cache.get(p.categoryId);
  if (!category) {
    const doc = await ctx.db.get("categories", p.categoryId);
    category = { name: doc?.name ?? "—", thumb: doc?.thumbnailPath ?? null };
    cache.set(p.categoryId, category);
  }
  return {
    _id: p._id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    manufacturerId: p.manufacturerId,
    manufacturerName: p.manufacturerName,
    categoryId: p.categoryId,
    categoryName: category.name,
    quality: p.quality,
    oemPrimary: p.oemPrimary ?? null,
    retailPricePara: p.retailPricePara,
    stockQty: p.stockQty,
    stockState: p.stockState,
    leadTimeDays: p.leadTimeDays ?? null,
    thumbUrl: p.primaryImageId ? await ctx.storage.getUrl(p.primaryImageId) : null,
    categoryThumb: category.thumb,
    imageCount: p.imageCount,
    fitmentCount: p.fitmentCount,
    active: p.active,
    isDemo: p.isDemo,
    updatedAt: p.updatedAt,
  };
}

/**
 * Staff product table. One index carries the query (search index with its filter fields,
 * or category / stock state / manufacturer index); remaining filters are post-filters on
 * the paginated range (D137).
 */
export const list = staffQuery({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    manufacturerId: v.optional(v.id("manufacturers")),
    active: v.optional(v.boolean()),
    stockState: v.optional(stockStateV),
    quality: v.optional(qualityV),
    demo: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(adminRowV),
  handler: async (ctx, args) => {
    const term = args.search?.trim().slice(0, 100);
    const code = term ? normalizeCode(term) : "";
    // An exact code (SKU / OEM / cross) answers first, as one page.
    if (term && code.length >= 4 && /\d/.test(code) && args.paginationOpts.cursor === null) {
      const codeRows = await ctx.db
        .query("productCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .take(50);
      if (codeRows.length > 0) {
        const cache: ListCache = new Map();
        const seen = new Set<string>();
        const page = [];
        for (const row of codeRows) {
          if (seen.has(row.productId)) continue;
          seen.add(row.productId);
          const p = await ctx.db.get("products", row.productId);
          if (p) page.push(await toAdminRow(ctx, p, cache));
        }
        return { page, isDone: true, continueCursor: "" };
      }
    }
    let used: "category" | "stock" | "manufacturer" | "search" | "none" = "none";
    const base = term
      ? ((used = "search"),
        ctx.db.query("products").withSearchIndex("search_products", (q) => {
          let s = q.search("searchText", foldForSearch(term));
          if (args.categoryId) s = s.eq("categoryId", args.categoryId);
          if (args.manufacturerId) s = s.eq("manufacturerId", args.manufacturerId);
          if (args.active !== undefined) s = s.eq("active", args.active);
          if (args.stockState) s = s.eq("stockState", args.stockState);
          if (args.quality) s = s.eq("quality", args.quality);
          return s;
        }))
      : args.categoryId
        ? ((used = "category"),
          ctx.db
            .query("products")
            .withIndex("by_categoryId_and_active_and_updatedAt", (q) =>
              args.active !== undefined
                ? q.eq("categoryId", args.categoryId!).eq("active", args.active)
                : q.eq("categoryId", args.categoryId!),
            )
            .order("desc"))
        : args.stockState
          ? ((used = "stock"),
            ctx.db
              .query("products")
              .withIndex("by_stockState_and_active", (q) =>
                args.active !== undefined
                  ? q.eq("stockState", args.stockState!).eq("active", args.active)
                  : q.eq("stockState", args.stockState!),
              )
              .order("desc"))
          : args.manufacturerId
            ? ((used = "manufacturer"),
              ctx.db
                .query("products")
                .withIndex("by_manufacturerId_and_active", (q) =>
                  args.active !== undefined
                    ? q.eq("manufacturerId", args.manufacturerId!).eq("active", args.active)
                    : q.eq("manufacturerId", args.manufacturerId!),
                )
                .order("desc"))
            : ctx.db.query("products").order("desc");
    const post = {
      manufacturer: args.manufacturerId && used !== "manufacturer" && used !== "search",
      stock: args.stockState && used !== "stock" && used !== "search",
      active: args.active !== undefined && used === "none",
      quality: args.quality && used !== "search",
      demo: args.demo !== undefined,
    };
    const query =
      post.manufacturer || post.stock || post.active || post.quality || post.demo
        ? base.filter((q) =>
            q.and(
              post.manufacturer ? q.eq(q.field("manufacturerId"), args.manufacturerId) : true,
              post.stock ? q.eq(q.field("stockState"), args.stockState) : true,
              post.active ? q.eq(q.field("active"), args.active) : true,
              post.quality ? q.eq(q.field("quality"), args.quality) : true,
              post.demo ? q.eq(q.field("isDemo"), args.demo) : true,
            ),
          )
        : base;
    const result = await query.paginate(args.paginationOpts);
    const cache: ListCache = new Map();
    const page = [];
    for (const p of result.page) page.push(await toAdminRow(ctx, p, cache));
    return { ...result, page };
  },
});

export const get = staffQuery({
  args: { productId: v.id("products") },
  returns: v.union(
    v.null(),
    v.object({
      product: adminRowV,
      costNetPara: v.union(v.number(), v.null()),
      supplierName: v.union(v.string(), v.null()),
      supplierSku: v.union(v.string(), v.null()),
      internalNote: v.union(v.string(), v.null()),
      marginBp: v.union(v.number(), v.null()),
      oemNumbers: v.array(
        v.object({ raw: v.string(), normalized: v.string(), brand: v.optional(v.string()) }),
      ),
      crossNumbers: v.array(
        v.object({ manufacturer: v.string(), raw: v.string(), normalized: v.string() }),
      ),
      fitmentCount: v.number(),
      lowStockThreshold: v.union(v.number(), v.null()),
      leadTimeDays: v.union(v.number(), v.null()),
      allowBackorder: v.boolean(),
    }),
  ),
  handler: async (ctx, { productId }) => {
    const p = await ctx.db.get("products", productId);
    if (!p) return null;
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const priv = await ctx.db
      .query("productPrivate")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const { vatRateBp } = (await getSettings(ctx)).commerce;
    const netRetail = (p.retailPricePara * 10_000) / (10_000 + vatRateBp);
    const marginBp =
      priv?.costNetPara && netRetail > 0
        ? Math.round(((netRetail - priv.costNetPara) / netRetail) * 10_000)
        : null;
    return {
      product: await toAdminRow(ctx, p, new Map()),
      costNetPara: priv?.costNetPara ?? null,
      supplierName: priv?.supplierName ?? null,
      supplierSku: priv?.supplierSku ?? null,
      internalNote: priv?.internalNote ?? null,
      marginBp,
      oemNumbers: content?.oemNumbers ?? [],
      crossNumbers: content?.crossNumbers ?? [],
      fitmentCount: p.fitmentCount,
      lowStockThreshold: p.lowStockThreshold ?? null,
      leadTimeDays: p.leadTimeDays ?? null,
      allowBackorder: p.allowBackorder,
    };
  },
});

export const create = staffMutation({
  args: productFields,
  returns: v.id("products"),
  handler: async (ctx, args) => {
    const actor = actorOf(ctx.viewer);
    const productId = await createProduct(
      ctx,
      { ...args, isDemo: false, source: "manual" },
      { actor, emit: true, stockReason: "receipt" },
    );
    await audit(ctx, {
      actor,
      action: "product.create",
      entityType: "product",
      entityId: productId,
      summary: `Novi artikal ${args.sku} — ${args.name}`,
    });
    return productId;
  },
});

export const update = staffMutation({
  args: {
    productId: v.id("products"),
    patch: v.object({
      sku: v.optional(v.string()),
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      categoryId: v.optional(v.id("categories")),
      manufacturerId: v.optional(v.id("manufacturers")),
      quality: v.optional(qualityV),
      mpn: v.optional(v.string()),
      ean: v.optional(v.string()),
      oemNumbers: v.optional(productFields.oemNumbers),
      crossNumbers: v.optional(productFields.crossNumbers),
      retailPricePara: v.optional(v.number()),
      stockQty: v.optional(v.number()),
      lowStockThreshold: v.optional(v.number()),
      leadTimeDays: v.optional(v.number()),
      allowBackorder: v.optional(v.boolean()),
      universal: v.optional(v.boolean()),
      fitments: v.optional(v.array(fitmentInputV)),
      description: v.optional(v.string()),
      specs: v.optional(productFields.specs),
      notes: v.optional(v.string()),
      seoTitle: v.optional(v.string()),
      seoDescription: v.optional(v.string()),
      weightGrams: v.optional(v.number()),
      warrantyMonths: v.optional(v.number()),
      costNetPara: v.optional(v.number()),
      supplierName: v.optional(v.string()),
      supplierSku: v.optional(v.string()),
      internalNote: v.optional(v.string()),
      popularity: v.optional(v.number()),
      active: v.optional(v.boolean()),
    }),
    note: v.optional(v.string()),
    /** Optional fields to remove (a cleared input in the editor). */
    clear: v.optional(v.array(clearableFieldV)),
  },
  returns: v.array(v.string()),
  handler: async (ctx, { productId, patch, note, clear }) => {
    const before = await ctx.db.get("products", productId);
    if (!before) return notFound("Artikal ne postoji.");
    const actor = actorOf(ctx.viewer);
    const full: ProductPatch = { ...(patch as ProductPatch) };
    for (const field of clear ?? []) full[field] = undefined;
    const changed = await updateProduct(ctx, productId, full, {
      actor,
      emit: true,
      priceReason: "manual",
      stockReason: "manual",
    });
    if (changed.length > 0) {
      await audit(ctx, {
        actor,
        action: "product.update",
        entityType: "product",
        entityId: productId,
        summary: `${before.sku}: ${changed.join(", ")}${note ? ` — ${note.slice(0, 200)}` : ""}`,
        diff: changed.map((field) => ({ field })),
      });
    }
    return changed;
  },
});

export const setActive = staffMutation({
  args: { productId: v.id("products"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { productId, active }) => {
    const before = await ctx.db.get("products", productId);
    if (!before) return notFound("Artikal ne postoji.");
    const actor = actorOf(ctx.viewer);
    const changed = await updateProduct(ctx, productId, { active }, { actor, emit: true });
    if (changed.length > 0) {
      await audit(ctx, {
        actor,
        action: active ? "product.activate" : "product.deactivate",
        entityType: "product",
        entityId: productId,
        summary: `${before.sku}: ${active ? "aktiviran" : "deaktiviran"}`,
      });
    }
    return null;
  },
});

/** Stock correction / receipt with a reason (every change recorded in stockMovements). */
export const adjustStock = staffMutation({
  args: {
    productId: v.id("products"),
    delta: v.number(),
    reason: v.union(
      v.literal("manual"),
      v.literal("correction"),
      v.literal("receipt"),
      v.literal("return"),
    ),
    note: v.optional(v.string()),
  },
  returns: v.object({ stockQty: v.number() }),
  handler: async (ctx, { productId, delta, reason, note }) => {
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000)
      invalid("Promena mora biti ceo broj različit od nule.", "delta");
    const product = await ctx.db.get("products", productId);
    if (!product) return notFound("Artikal ne postoji.");
    if (product.stockQty + delta < 0) invalid(`Na stanju je ${product.stockQty} kom.`, "delta");
    const actor = actorOf(ctx.viewer);
    await applyStockDelta(ctx, productId, delta, {
      reason,
      actor,
      refType: "manual",
      ...(note ? { note: note.slice(0, 300) } : {}),
    });
    await audit(ctx, {
      actor,
      action: "stock.adjust",
      entityType: "product",
      entityId: productId,
      summary: `${product.sku}: stanje ${product.stockQty} → ${product.stockQty + delta} (${reason})`,
      diff: [
        {
          field: "stockQty",
          before: String(product.stockQty),
          after: String(product.stockQty + delta),
        },
      ],
    });
    return { stockQty: product.stockQty + delta };
  },
});

export const history = staffQuery({
  args: { productId: v.id("products") },
  returns: v.object({
    audit: v.array(
      v.object({ action: v.string(), summary: v.string(), actor: actorV, at: v.number() }),
    ),
    prices: v.array(
      v.object({
        oldRetailPara: v.number(),
        newRetailPara: v.number(),
        reason: v.string(),
        at: v.number(),
      }),
    ),
    stock: v.array(
      v.object({
        delta: v.number(),
        qtyAfter: v.number(),
        reason: v.string(),
        note: v.union(v.string(), v.null()),
        at: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { productId }) => {
    const auditRows = await ctx.db
      .query("auditLog")
      .withIndex("by_entityType_and_entityId_and_at", (q) =>
        q.eq("entityType", "product").eq("entityId", productId),
      )
      .order("desc")
      .take(50);
    const prices = await ctx.db
      .query("priceChanges")
      .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
      .order("desc")
      .take(50);
    const stock = await ctx.db
      .query("stockMovements")
      .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
      .order("desc")
      .take(50);
    return {
      audit: auditRows.map((a) => ({
        action: a.action,
        summary: a.summary,
        actor: a.actor,
        at: a.at,
      })),
      prices: prices.map((p) => ({
        oldRetailPara: p.oldRetailPara,
        newRetailPara: p.newRetailPara,
        reason: p.reason,
        at: p.at,
      })),
      stock: stock.map((s) => ({
        delta: s.delta,
        qtyAfter: s.qtyAfter,
        reason: s.reason,
        note: s.note ?? null,
        at: s.at,
      })),
    };
  },
});

const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;

export const generateImageUploadUrl = staffMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await enforceRateLimit(ctx, "uploadUrl", `u:${ctx.viewer.userId}`);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attaches an uploaded image (type/size checked now, magic bytes checked right after). */
export const attachImage = staffMutation({
  args: {
    productId: v.id("products"),
    storageId: v.id("_storage"),
    alt: v.string(),
    width: v.number(),
    height: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta) return notFound("Slika nije otpremljena.");
    if (meta.size > MAX_PRODUCT_IMAGE_BYTES) invalid("Slika je veća od 10 MB.", "storageId");
    if (meta.contentType && !PRODUCT_IMAGE_TYPES.includes(meta.contentType)) {
      invalid("Dozvoljene su slike JPG, PNG, WebP ili AVIF.", "storageId");
    }
    const used = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (used) invalid("Slika je već iskorišćena.", "storageId");
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .unique();
    const images = content?.images ?? [];
    if (images.length >= MAX_PRODUCT_IMAGES) invalid("Najviše 12 slika po artiklu.", "storageId");
    const alt = args.alt.trim().slice(0, 160);
    if (!alt) invalid("Upišite opis slike (alt).", "alt");
    const actor = actorOf(ctx.viewer);
    await setProductImages(
      ctx,
      args.productId,
      [
        ...images,
        {
          storageId: args.storageId,
          alt,
          width: Math.round(args.width),
          height: Math.round(args.height),
        },
      ],
      { actor, emit: true },
    );
    await ctx.db.insert("uploads", {
      storageId: args.storageId,
      purpose: "product_image",
      uploaderKey: `u:${ctx.viewer.userId}`,
      status: "attached",
      ...(meta.contentType ? { contentType: meta.contentType } : {}),
      size: meta.size,
      attachedTo: { type: "product", id: args.productId },
    });
    await ctx.scheduler.runAfter(0, internal.files.sniff, { storageId: args.storageId });
    await audit(ctx, {
      actor,
      action: "product.image_add",
      entityType: "product",
      entityId: args.productId,
      summary: `Dodata slika: ${alt}`,
    });
    return null;
  },
});

export const reorderImages = staffMutation({
  args: { productId: v.id("products"), storageIds: v.array(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, { productId, storageIds }) => {
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const images = content?.images ?? [];
    if (
      storageIds.length !== images.length ||
      !images.every((img) => storageIds.includes(img.storageId))
    ) {
      invalid("Redosled mora sadržati sve slike artikla.", "storageIds");
    }
    const byId = new Map(images.map((img) => [img.storageId, img]));
    const actor = actorOf(ctx.viewer);
    await setProductImages(
      ctx,
      productId,
      storageIds.map((id) => byId.get(id)!),
      { actor, emit: true },
    );
    await audit(ctx, {
      actor,
      action: "product.image_reorder",
      entityType: "product",
      entityId: productId,
      summary: "Promenjen redosled slika",
    });
    return null;
  },
});

export const removeImage = staffMutation({
  args: { productId: v.id("products"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { productId, storageId }) => {
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const images = content?.images ?? [];
    if (!images.some((img) => img.storageId === storageId))
      return notFound("Slika ne pripada artiklu.");
    const actor = actorOf(ctx.viewer);
    await setProductImages(
      ctx,
      productId,
      images.filter((img) => img.storageId !== storageId),
      { actor, emit: true },
    );
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    if (upload) await ctx.db.delete("uploads", upload._id);
    await ctx.storage.delete(storageId);
    await audit(ctx, {
      actor,
      action: "product.image_remove",
      entityType: "product",
      entityId: productId,
      summary: "Uklonjena slika",
    });
    return null;
  },
});

const fitmentOutV = v.object({
  brandId: v.id("vehicleBrands"),
  modelId: v.id("vehicleModels"),
  generationId: v.id("vehicleGenerations"),
  engineId: v.union(v.id("engines"), v.null()),
  yearFrom: v.union(v.number(), v.null()),
  yearTo: v.union(v.number(), v.null()),
  note: v.union(v.string(), v.null()),
  label: v.string(),
  engineLabel: v.union(v.string(), v.null()),
});

/** Everything the product editor needs (staff only: includes cost and supplier data). */
export const getFull = staffQuery({
  args: { productId: v.id("products") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("products"),
      sku: v.string(),
      slug: v.string(),
      name: v.string(),
      categoryId: v.id("categories"),
      manufacturerId: v.id("manufacturers"),
      quality: qualityV,
      mpn: v.union(v.string(), v.null()),
      ean: v.union(v.string(), v.null()),
      retailPricePara: v.number(),
      stockQty: v.number(),
      stockState: stockStateV,
      lowStockThreshold: v.union(v.number(), v.null()),
      leadTimeDays: v.union(v.number(), v.null()),
      allowBackorder: v.boolean(),
      universal: v.boolean(),
      popularity: v.number(),
      active: v.boolean(),
      isDemo: v.boolean(),
      source: v.string(),
      updatedAt: v.number(),
      createdAt: v.number(),
      description: v.union(v.string(), v.null()),
      specs: v.array(
        v.object({ label: v.string(), value: v.string(), unit: v.optional(v.string()) }),
      ),
      notes: v.union(v.string(), v.null()),
      seoTitle: v.union(v.string(), v.null()),
      seoDescription: v.union(v.string(), v.null()),
      weightGrams: v.union(v.number(), v.null()),
      warrantyMonths: v.union(v.number(), v.null()),
      oemNumbers: v.array(v.object({ raw: v.string(), brand: v.optional(v.string()) })),
      crossNumbers: v.array(v.object({ manufacturer: v.string(), raw: v.string() })),
      images: v.array(
        v.object({
          storageId: v.id("_storage"),
          alt: v.string(),
          width: v.number(),
          height: v.number(),
          url: v.union(v.string(), v.null()),
        }),
      ),
      fitments: v.array(fitmentOutV),
      costNetPara: v.union(v.number(), v.null()),
      supplierName: v.union(v.string(), v.null()),
      supplierSku: v.union(v.string(), v.null()),
      internalNote: v.union(v.string(), v.null()),
      vatRateBp: v.number(),
      minMarginBp: v.number(),
      lowStockDefault: v.number(),
      categoryThumb: v.union(v.string(), v.null()),
      categorySlug: v.string(),
    }),
  ),
  handler: async (ctx, { productId }) => {
    const p = await ctx.db.get("products", productId);
    if (!p) return null;
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const priv = await ctx.db
      .query("productPrivate")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const fitmentRows = await ctx.db
      .query("fitments")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .take(250);
    const brandNames = new Map<string, string>();
    const fitments = [];
    for (const f of fitmentRows) {
      const generation = await ctx.db.get("vehicleGenerations", f.generationId);
      const model = await ctx.db.get("vehicleModels", f.modelId);
      if (!brandNames.has(f.brandId))
        brandNames.set(f.brandId, (await ctx.db.get("vehicleBrands", f.brandId))?.name ?? "");
      const engine = f.engineId ? await ctx.db.get("engines", f.engineId) : null;
      fitments.push({
        brandId: f.brandId,
        modelId: f.modelId,
        generationId: f.generationId,
        engineId: f.engineId ?? null,
        yearFrom: f.yearFrom ?? null,
        yearTo: f.yearTo ?? null,
        note: f.note ?? null,
        label: [brandNames.get(f.brandId), model?.name, generation?.name].filter(Boolean).join(" "),
        engineLabel: engine ? `${engine.name} · ${engine.powerKw} kW` : null,
      });
    }
    const images = [];
    for (const img of content?.images ?? []) {
      images.push({
        storageId: img.storageId,
        alt: img.alt,
        width: img.width,
        height: img.height,
        url: await ctx.storage.getUrl(img.storageId),
      });
    }
    const category = await ctx.db.get("categories", p.categoryId);
    const settings = await getSettings(ctx);
    return {
      _id: p._id,
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      categoryId: p.categoryId,
      manufacturerId: p.manufacturerId,
      quality: p.quality,
      mpn: p.mpn ?? null,
      ean: p.ean ?? null,
      retailPricePara: p.retailPricePara,
      stockQty: p.stockQty,
      stockState: p.stockState,
      lowStockThreshold: p.lowStockThreshold ?? null,
      leadTimeDays: p.leadTimeDays ?? null,
      allowBackorder: p.allowBackorder,
      universal: p.universal,
      popularity: p.popularity,
      active: p.active,
      isDemo: p.isDemo,
      source: p.source,
      updatedAt: p.updatedAt,
      createdAt: p._creationTime,
      description: content?.description ?? null,
      specs: content?.specs ?? [],
      notes: content?.notes ?? null,
      seoTitle: content?.seoTitle ?? null,
      seoDescription: content?.seoDescription ?? null,
      weightGrams: content?.weightGrams ?? null,
      warrantyMonths: content?.warrantyMonths ?? null,
      oemNumbers: (content?.oemNumbers ?? []).map((o) => ({
        raw: o.raw,
        ...(o.brand ? { brand: o.brand } : {}),
      })),
      crossNumbers: (content?.crossNumbers ?? []).map((c) => ({
        manufacturer: c.manufacturer,
        raw: c.raw,
      })),
      images,
      fitments,
      costNetPara: priv?.costNetPara ?? null,
      supplierName: priv?.supplierName ?? null,
      supplierSku: priv?.supplierSku ?? null,
      internalNote: priv?.internalNote ?? null,
      vatRateBp: settings.commerce.vatRateBp,
      minMarginBp: settings.commerce.minMarginBp,
      lowStockDefault: settings.commerce.lowStockDefault,
      categoryThumb: category?.thumbnailPath ?? null,
      categorySlug: category?.slug ?? "",
    };
  },
});

/** Copy of a product (inactive, stock 0, no images, SKU with a `-KOPIJA` suffix). */
export const duplicate = staffMutation({
  args: { productId: v.id("products") },
  returns: v.id("products"),
  handler: async (ctx, { productId }) => {
    const p = await ctx.db.get("products", productId);
    if (!p) return notFound("Artikal ne postoji.");
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const priv = await ctx.db
      .query("productPrivate")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .unique();
    const fitments = await ctx.db
      .query("fitments")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .take(200);
    let sku = `${p.sku}-KOPIJA`.slice(0, 64);
    for (let i = 2; i < 50; i++) {
      const taken = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", sku))
        .first();
      if (!taken) break;
      sku = `${p.sku}-KOPIJA-${i}`.slice(0, 64);
    }
    const actor = actorOf(ctx.viewer);
    const copyId = await createProduct(
      ctx,
      {
        sku,
        name: p.name,
        categoryId: p.categoryId,
        manufacturerId: p.manufacturerId,
        quality: p.quality,
        ...(p.mpn ? { mpn: p.mpn } : {}),
        oemNumbers: (content?.oemNumbers ?? []).map((o) => ({
          raw: o.raw,
          ...(o.brand ? { brand: o.brand } : {}),
        })),
        crossNumbers: (content?.crossNumbers ?? []).map((c) => ({
          manufacturer: c.manufacturer,
          raw: c.raw,
        })),
        retailPricePara: p.retailPricePara,
        stockQty: 0,
        ...(p.lowStockThreshold !== undefined ? { lowStockThreshold: p.lowStockThreshold } : {}),
        ...(p.leadTimeDays !== undefined ? { leadTimeDays: p.leadTimeDays } : {}),
        allowBackorder: p.allowBackorder,
        universal: p.universal,
        fitments: fitments.map((f) => ({
          brandId: f.brandId,
          modelId: f.modelId,
          generationId: f.generationId,
          ...(f.engineId ? { engineId: f.engineId } : {}),
          ...(f.yearFrom !== undefined ? { yearFrom: f.yearFrom } : {}),
          ...(f.yearTo !== undefined ? { yearTo: f.yearTo } : {}),
          ...(f.note ? { note: f.note } : {}),
        })),
        ...(content?.description ? { description: content.description } : {}),
        specs: content?.specs ?? [],
        ...(content?.notes ? { notes: content.notes } : {}),
        ...(content?.weightGrams !== undefined ? { weightGrams: content.weightGrams } : {}),
        ...(content?.warrantyMonths !== undefined
          ? { warrantyMonths: content.warrantyMonths }
          : {}),
        ...(priv?.costNetPara !== undefined ? { costNetPara: priv.costNetPara } : {}),
        ...(priv?.supplierName ? { supplierName: priv.supplierName } : {}),
        active: false,
        isDemo: false,
        source: "manual",
      },
      { actor, emit: true, stockReason: "manual" },
    );
    await audit(ctx, {
      actor,
      action: "product.duplicate",
      entityType: "product",
      entityId: copyId,
      summary: `Kopija artikla ${p.sku} → ${sku}`,
    });
    return copyId;
  },
});

const BULK_MAX = 100;

function checkBulk(ids: readonly Id<"products">[]): void {
  if (ids.length === 0) invalid("Izaberite bar jedan artikal.", "productIds");
  if (ids.length > BULK_MAX) invalid(`Najviše ${BULK_MAX} artikala odjednom.`, "productIds");
}

const bulkUndoV = v.array(
  v.object({
    productId: v.id("products"),
    active: v.optional(v.boolean()),
    categoryId: v.optional(v.id("categories")),
    retailPricePara: v.optional(v.number()),
  }),
);

/** Bulk activate / deactivate. Returns the previous values for „Poništi“. */
export const bulkSetActive = staffMutation({
  args: { productIds: v.array(v.id("products")), active: v.boolean() },
  returns: bulkUndoV,
  handler: async (ctx, { productIds, active }) => {
    checkBulk(productIds);
    const actor = actorOf(ctx.viewer);
    const undo = [];
    for (const productId of productIds) {
      const p = await ctx.db.get("products", productId);
      if (!p || p.active === active) continue;
      await updateProduct(ctx, productId, { active }, { actor, emit: true });
      undo.push({ productId, active: p.active });
    }
    await audit(ctx, {
      actor,
      action: active ? "product.bulk_activate" : "product.bulk_deactivate",
      entityType: "product",
      entityId: "bulk",
      summary: `${active ? "Aktivirano" : "Deaktivirano"} artikala: ${undo.length}`,
    });
    return undo;
  },
});

/** Bulk move to a category. Returns the previous categories for „Poništi“. */
export const bulkSetCategory = staffMutation({
  args: { productIds: v.array(v.id("products")), categoryId: v.id("categories") },
  returns: bulkUndoV,
  handler: async (ctx, { productIds, categoryId }) => {
    checkBulk(productIds);
    const category = await ctx.db.get("categories", categoryId);
    if (!category) return notFound("Kategorija ne postoji.");
    const actor = actorOf(ctx.viewer);
    const undo = [];
    for (const productId of productIds) {
      const p = await ctx.db.get("products", productId);
      if (!p || p.categoryId === categoryId) continue;
      await updateProduct(ctx, productId, { categoryId }, { actor, emit: true });
      undo.push({ productId, categoryId: p.categoryId });
    }
    await audit(ctx, {
      actor,
      action: "product.bulk_category",
      entityType: "product",
      entityId: "bulk",
      summary: `Premešteno u „${category.name}“: ${undo.length} artikala`,
    });
    return undo;
  },
});

/**
 * Bulk price change by a percentage (from -90 to +300), rounded to whole dinars. Returns
 * the previous prices for „Poništi“; every change lands in `priceChanges` (reason `bulk`).
 */
export const bulkAdjustPrice = staffMutation({
  args: { productIds: v.array(v.id("products")), percent: v.number() },
  returns: bulkUndoV,
  handler: async (ctx, { productIds, percent }) => {
    checkBulk(productIds);
    if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 300)
      invalid("Promena cene: od −90 % do +300 %.", "percent");
    const actor = actorOf(ctx.viewer);
    const undo = [];
    for (const productId of productIds) {
      const p = await ctx.db.get("products", productId);
      if (!p) continue;
      const next = Math.max(0, Math.round((p.retailPricePara * (1 + percent / 100)) / 100) * 100);
      if (next === p.retailPricePara) continue;
      await updateProduct(
        ctx,
        productId,
        { retailPricePara: next },
        { actor, emit: true, priceReason: "bulk" },
      );
      undo.push({ productId, retailPricePara: p.retailPricePara });
    }
    const sign = percent > 0 ? "+" : "";
    await audit(ctx, {
      actor,
      action: "product.bulk_price",
      entityType: "product",
      entityId: "bulk",
      summary: `Cene ${sign}${String(percent).replace(".", ",")} %: ${undo.length} artikala`,
    });
    return undo;
  },
});

/** Undo of a bulk action: restores the values returned by the bulk mutation. */
export const bulkRestore = staffMutation({
  args: { items: bulkUndoV },
  returns: v.null(),
  handler: async (ctx, { items }) => {
    if (items.length > BULK_MAX) invalid(`Najviše ${BULK_MAX} artikala odjednom.`);
    const actor = actorOf(ctx.viewer);
    for (const item of items) {
      const patch: ProductPatch = {};
      if (item.active !== undefined) patch.active = item.active;
      if (item.categoryId !== undefined) patch.categoryId = item.categoryId;
      if (item.retailPricePara !== undefined) patch.retailPricePara = item.retailPricePara;
      if (!(await ctx.db.get("products", item.productId))) continue;
      await updateProduct(ctx, item.productId, patch, { actor, emit: true, priceReason: "bulk" });
    }
    await audit(ctx, {
      actor,
      action: "product.bulk_undo",
      entityType: "product",
      entityId: "bulk",
      summary: `Poništena grupna izmena: ${items.length} artikala`,
    });
    return null;
  },
});

/** Line picker for quotes and order edits: code first, then text (active and inactive). */
export const pick = staffQuery({
  args: { q: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("products"),
      sku: v.string(),
      name: v.string(),
      manufacturerName: v.string(),
      quality: qualityV,
      oemPrimary: v.union(v.string(), v.null()),
      retailPricePara: v.number(),
      stockQty: v.number(),
      stockState: stockStateV,
      leadTimeDays: v.union(v.number(), v.null()),
      active: v.boolean(),
    }),
  ),
  handler: async (ctx, { q }) => {
    const term = q.trim().slice(0, 100);
    if (term.length < 2) return [];
    const found = new Map<Id<"products">, Doc<"products">>();
    const code = normalizeCode(term);
    if (code.length >= 3 && /\d/.test(code)) {
      const rows = await ctx.db
        .query("productCodes")
        .withIndex("by_code", (x) => x.eq("code", code))
        .take(10);
      for (const row of rows) {
        const p = await ctx.db.get("products", row.productId);
        if (p) found.set(p._id, p);
      }
    }
    if (found.size < 10) {
      const rows = await ctx.db
        .query("products")
        .withSearchIndex("search_products", (x) => x.search("searchText", foldForSearch(term)))
        .take(10);
      for (const p of rows) if (!found.has(p._id)) found.set(p._id, p);
    }
    return [...found.values()].slice(0, 10).map((p) => ({
      _id: p._id,
      sku: p.sku,
      name: p.name,
      manufacturerName: p.manufacturerName,
      quality: p.quality,
      oemPrimary: p.oemPrimary ?? null,
      retailPricePara: p.retailPricePara,
      stockQty: p.stockQty,
      stockState: p.stockState,
      leadTimeDays: p.leadTimeDays ?? null,
      active: p.active,
    }));
  },
});
