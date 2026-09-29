/**
 * Staff product management. All writes go through `productWriter` (the only product
 * write path) and are audited. Cost and supplier data are visible here only.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

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

const adminRowV = v.object({
  _id: v.id("products"),
  sku: v.string(),
  slug: v.string(),
  name: v.string(),
  manufacturerName: v.string(),
  categoryId: v.id("categories"),
  quality: qualityV,
  retailPricePara: v.number(),
  stockQty: v.number(),
  stockState: stockStateV,
  active: v.boolean(),
  isDemo: v.boolean(),
  updatedAt: v.number(),
});

export const list = staffQuery({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(adminRowV),
  handler: async (ctx, { search, categoryId, paginationOpts }) => {
    const term = search?.trim().toLowerCase().slice(0, 100);
    const result = term
      ? await ctx.db
          .query("products")
          .withSearchIndex("search_products", (q) =>
            categoryId
              ? q.search("searchText", term).eq("categoryId", categoryId)
              : q.search("searchText", term),
          )
          .paginate(paginationOpts)
      : categoryId
        ? await ctx.db
            .query("products")
            .withIndex("by_categoryId_and_active_and_updatedAt", (q) =>
              q.eq("categoryId", categoryId),
            )
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db.query("products").order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((p) => ({
        _id: p._id,
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        manufacturerName: p.manufacturerName,
        categoryId: p.categoryId,
        quality: p.quality,
        retailPricePara: p.retailPricePara,
        stockQty: p.stockQty,
        stockState: p.stockState,
        active: p.active,
        isDemo: p.isDemo,
        updatedAt: p.updatedAt,
      })),
    };
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
      product: {
        _id: p._id,
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        manufacturerName: p.manufacturerName,
        categoryId: p.categoryId,
        quality: p.quality,
        retailPricePara: p.retailPricePara,
        stockQty: p.stockQty,
        stockState: p.stockState,
        active: p.active,
        isDemo: p.isDemo,
        updatedAt: p.updatedAt,
      },
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
  },
  returns: v.array(v.string()),
  handler: async (ctx, { productId, patch, note }) => {
    const before = await ctx.db.get("products", productId);
    if (!before) return notFound("Artikal ne postoji.");
    const actor = actorOf(ctx.viewer);
    const changed = await updateProduct(ctx, productId, patch as ProductPatch, {
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
