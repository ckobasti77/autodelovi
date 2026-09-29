/**
 * The ONLY code that writes products (docs/DATA-MODEL.md §C4 catalog invariants):
 * - `productCodes` mirror sku / mpn / ean / oem / cross exactly (normalised);
 * - fitment and code rows carry the product's denormalised fields;
 * - `stockState` is derived from qty, threshold, lead time and backorder;
 * - category and manufacturer counters move in the same transaction;
 * - price changes are recorded in `priceChanges`, stock changes in `stockMovements`;
 * - slug changes insert a redirect; changes emit `product.changed` (unless seeding).
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeCode } from "../../lib/domain/codes";
import { buildSearchText } from "../../lib/domain/search";
import { slugifySr } from "../../lib/domain/slug";
import { deriveStockState, isAvailableNow, type StockState } from "../../lib/domain/stock";
import { withoutSystemFields } from "./docs";
import { invalid, notFound } from "./errors";
import { emitEvent } from "./events";
import { getSettings } from "./settings";
import type { Actor, Quality } from "./validators";

export type ProductImage = {
  storageId: Id<"_storage">;
  alt: string;
  width: number;
  height: number;
  sourceUrl?: string;
};

export const MAX_PRODUCT_IMAGES = 12;

/** Replaces the image list (order = display order); keeps primaryImageId/imageCount in sync. */
export async function setProductImages(
  ctx: MutationCtx,
  productId: Id<"products">,
  images: ProductImage[],
  meta: WriteMeta,
): Promise<void> {
  if (images.length > MAX_PRODUCT_IMAGES) invalid("Najviše 12 slika po artiklu.", "images");
  const product = await ctx.db.get("products", productId);
  if (!product) return notFound("Artikal ne postoji.");
  const content = await ctx.db
    .query("productContent")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .unique();
  const now = Date.now();
  if (content) await ctx.db.patch("productContent", content._id, { images, updatedAt: now });
  else {
    await ctx.db.insert("productContent", {
      productId,
      specs: [],
      oemNumbers: [],
      crossNumbers: [],
      images,
      updatedAt: now,
    });
  }
  await ctx.db.patch("products", productId, {
    primaryImageId: images[0]?.storageId,
    imageCount: images.length,
    updatedAt: now,
    contentUpdatedAt: now,
  });
  if (meta.emit) {
    await emitEvent(ctx, {
      type: "product.changed",
      aggregateType: "product",
      aggregateId: productId,
      payload: { kind: "catalog", productId, slug: product.slug, fields: ["images"] },
      dedupeKey: `product.changed:${productId}:images:${now}`,
      actor: meta.actor,
    });
  }
}

export type FitmentInput = {
  brandId: Id<"vehicleBrands">;
  modelId: Id<"vehicleModels">;
  generationId: Id<"vehicleGenerations">;
  engineId?: Id<"engines">;
  yearFrom?: number;
  yearTo?: number;
  note?: string;
};

export type OemInput = { raw: string; brand?: string };
export type CrossInput = { manufacturer: string; raw: string };
export type SpecInput = { label: string; value: string; unit?: string };

export type ProductInput = {
  sku: string;
  name: string;
  slug?: string;
  categoryId: Id<"categories">;
  manufacturerId: Id<"manufacturers">;
  quality?: Quality;
  mpn?: string;
  ean?: string;
  oemNumbers: OemInput[];
  crossNumbers: CrossInput[];
  retailPricePara: number;
  stockQty: number;
  lowStockThreshold?: number;
  leadTimeDays?: number;
  allowBackorder: boolean;
  universal: boolean;
  fitments: FitmentInput[];
  description?: string;
  specs: SpecInput[];
  notes?: string;
  seoTitle?: string;
  seoDescription?: string;
  weightGrams?: number;
  warrantyMonths?: number;
  costNetPara?: number;
  supplierName?: string;
  supplierSku?: string;
  internalNote?: string;
  popularity?: number;
  active: boolean;
  isDemo: boolean;
  source: "seed" | "import" | "manual";
};

export type ProductPatch = Partial<Omit<ProductInput, "isDemo" | "source">>;

export type WriteMeta = {
  actor: Actor;
  /** Seeds skip the outbox (no cache to revalidate yet). */
  emit: boolean;
  priceReason?: "manual" | "import" | "import_rollback" | "bulk";
  stockReason?: Doc<"stockMovements">["reason"];
  importBatchId?: Id<"importBatches">;
};

export const LIMITS = {
  sku: 64,
  name: 160,
  oem: 50,
  cross: 100,
  specs: 40,
  fitments: 200,
  description: 5_000,
  maxQty: 1_000_000,
} as const;

function assertInt(value: number, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    invalid(`Neispravna vrednost: ${name}.`, name);
  }
}

function validate(input: ProductInput): void {
  const sku = input.sku.trim();
  if (!sku || sku.length > LIMITS.sku) invalid("Šifra artikla je obavezna (do 64 znaka).", "sku");
  const name = input.name.trim();
  if (!name || name.length > LIMITS.name) invalid("Naziv je obavezan (do 160 znakova).", "name");
  assertInt(input.retailPricePara, "retailPricePara");
  assertInt(input.stockQty, "stockQty", 0, LIMITS.maxQty);
  if (input.lowStockThreshold !== undefined)
    assertInt(input.lowStockThreshold, "lowStockThreshold", 0, 10_000);
  if (input.leadTimeDays !== undefined) assertInt(input.leadTimeDays, "leadTimeDays", 0, 365);
  if (input.costNetPara !== undefined) assertInt(input.costNetPara, "costNetPara");
  if (input.oemNumbers.length > LIMITS.oem) invalid("Najviše 50 OEM brojeva.", "oemNumbers");
  if (input.crossNumbers.length > LIMITS.cross)
    invalid("Najviše 100 zamenskih brojeva.", "crossNumbers");
  if (input.specs.length > LIMITS.specs) invalid("Najviše 40 tehničkih podataka.", "specs");
  if (input.fitments.length > LIMITS.fitments)
    invalid("Najviše 200 vozila po artiklu.", "fitments");
  if ((input.description?.length ?? 0) > LIMITS.description)
    invalid("Opis je predugačak.", "description");
}

type CodeRow = { code: string; kind: Doc<"productCodes">["kind"]; raw: string; label?: string };

export function buildCodeRows(
  input: Pick<ProductInput, "sku" | "mpn" | "ean" | "oemNumbers" | "crossNumbers"> & {
    manufacturerName: string;
  },
): CodeRow[] {
  const rows: CodeRow[] = [];
  const seen = new Set<string>();
  const push = (kind: CodeRow["kind"], raw: string | undefined, label?: string) => {
    if (!raw) return;
    const code = normalizeCode(raw);
    if (code.length < 3) return;
    const key = `${kind}:${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ code, kind, raw: raw.trim(), ...(label ? { label } : {}) });
  };
  push("sku", input.sku);
  push("mpn", input.mpn, input.manufacturerName);
  push("ean", input.ean);
  for (const oem of input.oemNumbers) push("oem", oem.raw, oem.brand);
  for (const cross of input.crossNumbers) push("cross", cross.raw, cross.manufacturer);
  return rows;
}

const BRAND_SHORT: Record<string, string> = { Volkswagen: "VW" };

type VehicleLabels = { summary: string | undefined; labels: string[] };

async function vehicleLabels(
  ctx: MutationCtx,
  fitments: readonly FitmentInput[],
): Promise<VehicleLabels> {
  const labels: string[] = [];
  const seen = new Set<string>();
  const brandNames = new Map<Id<"vehicleBrands">, string>();
  for (const f of fitments) {
    if (seen.has(f.generationId)) continue;
    seen.add(f.generationId);
    const generation = await ctx.db.get("vehicleGenerations", f.generationId);
    if (!generation) continue;
    let brand = brandNames.get(generation.brandId);
    if (!brand) {
      const doc = await ctx.db.get("vehicleBrands", generation.brandId);
      brand = doc ? (BRAND_SHORT[doc.name] ?? doc.name) : "";
      brandNames.set(generation.brandId, brand);
    }
    labels.push(`${brand} ${generation.name}`.trim());
  }
  if (labels.length === 0) return { summary: undefined, labels };
  const shown = labels.slice(0, 2).join(", ");
  const rest = labels.length - 2;
  return { summary: rest > 0 ? `${shown} i još ${rest}` : shown, labels };
}

async function uniqueSlug(
  ctx: MutationCtx,
  base: string,
  selfId?: Id<"products">,
): Promise<string> {
  const root = base || "deo";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const hit = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!hit || hit._id === selfId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function adjustCounts(
  ctx: MutationCtx,
  categoryId: Id<"categories">,
  manufacturerId: Id<"manufacturers">,
  productDelta: number,
  inStockDelta: number,
): Promise<void> {
  if (productDelta === 0 && inStockDelta === 0) return;
  const category = await ctx.db.get("categories", categoryId);
  if (category) {
    await ctx.db.patch("categories", categoryId, {
      productCount: Math.max(0, category.productCount + productDelta),
      inStockCount: Math.max(0, category.inStockCount + inStockDelta),
    });
  }
  if (productDelta !== 0) {
    const manufacturer = await ctx.db.get("manufacturers", manufacturerId);
    if (manufacturer) {
      await ctx.db.patch("manufacturers", manufacturerId, {
        productCount: Math.max(0, manufacturer.productCount + productDelta),
      });
    }
  }
}

function countsFor(product: { active: boolean; deletedAt?: number; stockState: StockState }) {
  const listed = product.active && product.deletedAt === undefined;
  return { product: listed ? 1 : 0, inStock: listed && isAvailableNow(product.stockState) ? 1 : 0 };
}

async function replaceCodes(
  ctx: MutationCtx,
  productId: Id<"products">,
  rows: CodeRow[],
  categoryId: Id<"categories">,
  active: boolean,
): Promise<void> {
  const existing = await ctx.db
    .query("productCodes")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(500);
  for (const row of existing) await ctx.db.delete("productCodes", row._id);
  for (const row of rows) {
    await ctx.db.insert("productCodes", { ...row, productId, categoryId, active });
  }
}

async function replaceFitments(
  ctx: MutationCtx,
  product: Pick<Doc<"products">, "_id" | "categoryId" | "manufacturerId" | "quality" | "active">,
  fitments: readonly FitmentInput[],
): Promise<void> {
  const existing = await ctx.db
    .query("fitments")
    .withIndex("by_productId", (q) => q.eq("productId", product._id))
    .take(LIMITS.fitments + 50);
  for (const row of existing) await ctx.db.delete("fitments", row._id);
  for (const f of fitments) {
    const generation = await ctx.db.get("vehicleGenerations", f.generationId);
    if (!generation || generation.modelId !== f.modelId || generation.brandId !== f.brandId) {
      invalid("Vozilo u listi kompatibilnosti ne postoji.", "fitments");
    }
    await ctx.db.insert("fitments", {
      productId: product._id,
      brandId: f.brandId,
      modelId: f.modelId,
      generationId: f.generationId,
      ...(f.engineId ? { engineId: f.engineId } : {}),
      ...(f.yearFrom !== undefined ? { yearFrom: f.yearFrom } : {}),
      ...(f.yearTo !== undefined ? { yearTo: f.yearTo } : {}),
      ...(f.note ? { note: f.note } : {}),
      categoryId: product.categoryId,
      active: product.active,
      manufacturerId: product.manufacturerId,
      quality: product.quality,
    });
  }
}

/** Rewrites denormalised fields on existing fitment/code rows (category/manufacturer/active). */
async function syncDenormalized(ctx: MutationCtx, product: Doc<"products">): Promise<void> {
  const fitments = await ctx.db
    .query("fitments")
    .withIndex("by_productId", (q) => q.eq("productId", product._id))
    .take(LIMITS.fitments + 50);
  for (const f of fitments) {
    if (
      f.categoryId !== product.categoryId ||
      f.active !== product.active ||
      f.manufacturerId !== product.manufacturerId ||
      f.quality !== product.quality
    ) {
      await ctx.db.patch("fitments", f._id, {
        categoryId: product.categoryId,
        active: product.active,
        manufacturerId: product.manufacturerId,
        quality: product.quality,
      });
    }
  }
  const codes = await ctx.db
    .query("productCodes")
    .withIndex("by_productId", (q) => q.eq("productId", product._id))
    .take(500);
  for (const c of codes) {
    if (c.categoryId !== product.categoryId || c.active !== product.active) {
      await ctx.db.patch("productCodes", c._id, {
        categoryId: product.categoryId,
        active: product.active,
      });
    }
  }
}

async function buildProductSearchText(
  ctx: MutationCtx,
  input: Pick<ProductInput, "name" | "sku" | "mpn" | "oemNumbers" | "crossNumbers" | "categoryId">,
  manufacturerName: string,
  labels: string[],
): Promise<string> {
  const category = await ctx.db.get("categories", input.categoryId);
  const codeParts = [
    input.sku,
    input.mpn,
    input.mpn ? normalizeCode(input.mpn) : undefined,
    ...input.oemNumbers.flatMap((o) => [o.raw, normalizeCode(o.raw)]),
    ...input.crossNumbers.slice(0, 20).map((c) => normalizeCode(c.raw)),
  ];
  return buildSearchText([input.name, manufacturerName, category?.name, ...codeParts, ...labels]);
}

async function recordMovement(
  ctx: MutationCtx,
  productId: Id<"products">,
  before: number,
  after: number,
  movement: {
    reason: Doc<"stockMovements">["reason"];
    actor: Actor;
    refType?: Doc<"stockMovements">["refType"];
    refId?: string;
    note?: string;
    importBatchId?: Id<"importBatches">;
  },
): Promise<void> {
  if (before === after) return;
  await ctx.db.insert("stockMovements", {
    productId,
    delta: after - before,
    qtyBefore: before,
    qtyAfter: after,
    reason: movement.reason,
    ...(movement.refType ? { refType: movement.refType } : {}),
    ...(movement.refId ? { refId: movement.refId } : {}),
    actor: movement.actor,
    ...(movement.note ? { note: movement.note } : {}),
    ...(movement.importBatchId ? { importBatchId: movement.importBatchId } : {}),
    at: Date.now(),
  });
}

/** Emits stock.low / stock.back_in_stock when a change crosses the thresholds. */
async function emitStockEvents(
  ctx: MutationCtx,
  product: Doc<"products">,
  beforeQty: number,
  beforeState: StockState,
  actor: Actor,
): Promise<void> {
  const now = Date.now();
  if (beforeQty === 0 && product.stockQty > 0) {
    await emitEvent(ctx, {
      type: "stock.back_in_stock",
      aggregateType: "stock",
      aggregateId: product._id,
      payload: {
        kind: "stock",
        productId: product._id,
        sku: product.sku,
        name: product.name,
        qty: product.stockQty,
      },
      dedupeKey: `stock.back_in_stock:${product._id}:${now}`,
      actor,
    });
  }
  const wasAvailable = beforeState === "in_stock";
  const nowLow = product.stockState === "low_stock" || product.stockState === "out_of_stock";
  if (wasAvailable && nowLow && product.active) {
    await emitEvent(ctx, {
      type: "stock.low",
      aggregateType: "stock",
      aggregateId: product._id,
      payload: {
        kind: "stock",
        productId: product._id,
        sku: product.sku,
        name: product.name,
        qty: product.stockQty,
        ...(product.lowStockThreshold !== undefined
          ? { threshold: product.lowStockThreshold }
          : {}),
      },
      dedupeKey: `stock.low:${product._id}:${now}`,
      actor,
    });
  }
}

export async function createProduct(
  ctx: MutationCtx,
  input: ProductInput,
  meta: WriteMeta,
): Promise<Id<"products">> {
  validate(input);
  const sku = input.sku.trim();
  const taken = await ctx.db
    .query("products")
    .withIndex("by_sku", (q) => q.eq("sku", sku))
    .first();
  if (taken) invalid(`Šifra ${sku} već postoji.`, "sku");
  const category = await ctx.db.get("categories", input.categoryId);
  if (!category) notFound("Kategorija ne postoji.");
  const manufacturer = await ctx.db.get("manufacturers", input.manufacturerId);
  if (!manufacturer) notFound("Proizvođač ne postoji.");

  const settings = await getSettings(ctx);
  const now = Date.now();
  const stockState = deriveStockState(input, settings.commerce.lowStockDefault);
  const { summary, labels } = await vehicleLabels(ctx, input.fitments);
  const slug = await uniqueSlug(ctx, input.slug ?? slugifySr(`${input.name} ${sku}`));
  const quality = input.quality ?? manufacturer.defaultQuality;

  const productId = await ctx.db.insert("products", {
    sku,
    slug,
    name: input.name.trim(),
    categoryId: input.categoryId,
    systemSlug: category.systemSlug,
    manufacturerId: input.manufacturerId,
    manufacturerName: manufacturer.name,
    quality,
    ...(input.mpn ? { mpn: input.mpn.trim() } : {}),
    ...(input.oemNumbers[0] ? { oemPrimary: input.oemNumbers[0].raw.trim() } : {}),
    ...(input.ean ? { ean: input.ean.trim() } : {}),
    retailPricePara: input.retailPricePara,
    stockQty: input.stockQty,
    stockState,
    ...(input.lowStockThreshold !== undefined
      ? { lowStockThreshold: input.lowStockThreshold }
      : {}),
    ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
    allowBackorder: input.allowBackorder,
    imageCount: 0,
    universal: input.universal,
    fitmentCount: input.fitments.length,
    ...(summary ? { fitmentSummary: summary } : {}),
    searchText: await buildProductSearchText(ctx, input, manufacturer.name, labels),
    popularity: input.popularity ?? 0,
    active: input.active,
    isDemo: input.isDemo,
    source: input.source,
    ...(meta.importBatchId
      ? { importBatchId: meta.importBatchId, lastImportBatchId: meta.importBatchId }
      : {}),
    updatedAt: now,
    contentUpdatedAt: now,
  });

  await ctx.db.insert("productContent", {
    productId,
    ...(input.description ? { description: input.description } : {}),
    specs: input.specs,
    oemNumbers: input.oemNumbers.map((o) => ({
      raw: o.raw.trim(),
      normalized: normalizeCode(o.raw),
      ...(o.brand ? { brand: o.brand } : {}),
    })),
    crossNumbers: input.crossNumbers.map((c) => ({
      manufacturer: c.manufacturer,
      raw: c.raw.trim(),
      normalized: normalizeCode(c.raw),
    })),
    images: [],
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.seoTitle ? { seoTitle: input.seoTitle } : {}),
    ...(input.seoDescription ? { seoDescription: input.seoDescription } : {}),
    ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
    ...(input.warrantyMonths !== undefined ? { warrantyMonths: input.warrantyMonths } : {}),
    updatedAt: now,
  });

  await ctx.db.insert("productPrivate", {
    productId,
    ...(input.costNetPara !== undefined ? { costNetPara: input.costNetPara } : {}),
    ...(input.supplierName ? { supplierName: input.supplierName } : {}),
    ...(input.supplierSku ? { supplierSku: input.supplierSku } : {}),
    ...(input.internalNote ? { internalNote: input.internalNote } : {}),
    updatedAt: now,
  });

  await replaceCodes(
    ctx,
    productId,
    buildCodeRows({ ...input, manufacturerName: manufacturer.name }),
    input.categoryId,
    input.active,
  );
  await replaceFitments(
    ctx,
    {
      _id: productId,
      categoryId: input.categoryId,
      manufacturerId: input.manufacturerId,
      quality,
      active: input.active,
    },
    input.fitments,
  );
  await recordMovement(ctx, productId, 0, input.stockQty, {
    reason: meta.stockReason ?? (input.source === "import" ? "import" : "receipt"),
    actor: meta.actor,
    refType: meta.importBatchId ? "import" : "manual",
    note: "Početno stanje",
    ...(meta.importBatchId ? { importBatchId: meta.importBatchId } : {}),
  });
  const counts = countsFor({ active: input.active, stockState });
  await adjustCounts(ctx, input.categoryId, input.manufacturerId, counts.product, counts.inStock);

  if (meta.emit) {
    await emitEvent(ctx, {
      type: "product.changed",
      aggregateType: "product",
      aggregateId: productId,
      payload: { kind: "catalog", productId, slug, fields: ["created"] },
      dedupeKey: `product.changed:${productId}:${now}`,
      actor: meta.actor,
    });
  }
  return productId;
}

const CONTENT_FIELDS = [
  "description",
  "specs",
  "notes",
  "seoTitle",
  "seoDescription",
  "weightGrams",
  "warrantyMonths",
] as const;
const PRIVATE_FIELDS = ["costNetPara", "supplierName", "supplierSku", "internalNote"] as const;

/**
 * Applies a partial update and keeps every invariant. Returns the names of changed fields.
 * `stockQty` changes here are recorded with `meta.stockReason` (default `manual`).
 */
export async function updateProduct(
  ctx: MutationCtx,
  productId: Id<"products">,
  patch: ProductPatch,
  meta: WriteMeta,
): Promise<string[]> {
  const product = await ctx.db.get("products", productId);
  if (!product) return notFound("Artikal ne postoji.");
  const content = await ctx.db
    .query("productContent")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .unique();
  const priv = await ctx.db
    .query("productPrivate")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .unique();

  const current: ProductInput = {
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    manufacturerId: product.manufacturerId,
    quality: product.quality,
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(product.ean ? { ean: product.ean } : {}),
    oemNumbers: (content?.oemNumbers ?? []).map((o) => ({
      raw: o.raw,
      ...(o.brand ? { brand: o.brand } : {}),
    })),
    crossNumbers: (content?.crossNumbers ?? []).map((c) => ({
      manufacturer: c.manufacturer,
      raw: c.raw,
    })),
    retailPricePara: product.retailPricePara,
    stockQty: product.stockQty,
    ...(product.lowStockThreshold !== undefined
      ? { lowStockThreshold: product.lowStockThreshold }
      : {}),
    ...(product.leadTimeDays !== undefined ? { leadTimeDays: product.leadTimeDays } : {}),
    allowBackorder: product.allowBackorder,
    universal: product.universal,
    fitments: [],
    ...(content?.description ? { description: content.description } : {}),
    specs: content?.specs ?? [],
    ...(content?.notes ? { notes: content.notes } : {}),
    ...(content?.seoTitle ? { seoTitle: content.seoTitle } : {}),
    ...(content?.seoDescription ? { seoDescription: content.seoDescription } : {}),
    ...(content?.weightGrams !== undefined ? { weightGrams: content.weightGrams } : {}),
    ...(content?.warrantyMonths !== undefined ? { warrantyMonths: content.warrantyMonths } : {}),
    ...(priv?.costNetPara !== undefined ? { costNetPara: priv.costNetPara } : {}),
    ...(priv?.supplierName ? { supplierName: priv.supplierName } : {}),
    ...(priv?.supplierSku ? { supplierSku: priv.supplierSku } : {}),
    ...(priv?.internalNote ? { internalNote: priv.internalNote } : {}),
    popularity: product.popularity,
    active: product.active,
    isDemo: product.isDemo,
    source: product.source,
  };
  const next: ProductInput = { ...current, ...patch };
  const fitmentsChanged = patch.fitments !== undefined;
  if (!fitmentsChanged) {
    const rows = await ctx.db
      .query("fitments")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .take(LIMITS.fitments + 50);
    next.fitments = rows.map((f) => ({
      brandId: f.brandId,
      modelId: f.modelId,
      generationId: f.generationId,
      ...(f.engineId ? { engineId: f.engineId } : {}),
      ...(f.yearFrom !== undefined ? { yearFrom: f.yearFrom } : {}),
      ...(f.yearTo !== undefined ? { yearTo: f.yearTo } : {}),
      ...(f.note ? { note: f.note } : {}),
    }));
  }
  validate(next);

  const changed = (Object.keys(patch) as (keyof ProductPatch)[]).filter(
    (key) => JSON.stringify(patch[key]) !== JSON.stringify(current[key]),
  );
  if (changed.length === 0) return [];

  if (next.sku.trim() !== product.sku) {
    const taken = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", next.sku.trim()))
      .first();
    if (taken && taken._id !== productId) invalid(`Šifra ${next.sku} već postoji.`, "sku");
  }
  const category = await ctx.db.get("categories", next.categoryId);
  if (!category) return notFound("Kategorija ne postoji.");
  const manufacturer = await ctx.db.get("manufacturers", next.manufacturerId);
  if (!manufacturer) return notFound("Proizvođač ne postoji.");

  const settings = await getSettings(ctx);
  const now = Date.now();
  const stockState = deriveStockState(next, settings.commerce.lowStockDefault);
  const { summary, labels } = await vehicleLabels(ctx, next.fitments);
  const slug =
    patch.slug !== undefined && patch.slug !== product.slug
      ? await uniqueSlug(ctx, slugifySr(patch.slug), productId)
      : product.slug;
  const quality =
    patch.quality ?? (patch.manufacturerId ? manufacturer.defaultQuality : product.quality);

  const contentChanged = changed.some((k) =>
    [
      "name",
      "description",
      "specs",
      "notes",
      "oemNumbers",
      "crossNumbers",
      "fitments",
      "slug",
      "seoTitle",
      "seoDescription",
    ].includes(k),
  );

  const base = withoutSystemFields(product);
  // Optional fields set to `undefined` are dropped by `replace` (field removed).
  const replacement: Omit<Doc<"products">, "_id" | "_creationTime"> = {
    ...base,
    sku: next.sku.trim(),
    slug,
    name: next.name.trim(),
    categoryId: next.categoryId,
    systemSlug: category.systemSlug,
    manufacturerId: next.manufacturerId,
    manufacturerName: manufacturer.name,
    quality,
    mpn: next.mpn?.trim() || undefined,
    oemPrimary: next.oemNumbers[0]?.raw.trim() || undefined,
    ean: next.ean?.trim() || undefined,
    retailPricePara: next.retailPricePara,
    stockQty: next.stockQty,
    stockState,
    lowStockThreshold: next.lowStockThreshold,
    leadTimeDays: next.leadTimeDays,
    allowBackorder: next.allowBackorder,
    universal: next.universal,
    fitmentCount: next.fitments.length,
    fitmentSummary: summary,
    searchText: await buildProductSearchText(ctx, next, manufacturer.name, labels),
    popularity: next.popularity ?? product.popularity,
    active: next.active,
    ...(meta.importBatchId ? { lastImportBatchId: meta.importBatchId } : {}),
    updatedAt: now,
    contentUpdatedAt: contentChanged ? now : product.contentUpdatedAt,
  };
  await ctx.db.replace("products", productId, replacement);
  const saved = (await ctx.db.get("products", productId))!;

  if (
    changed.some(
      (k) =>
        (CONTENT_FIELDS as readonly string[]).includes(k) ||
        k === "oemNumbers" ||
        k === "crossNumbers",
    )
  ) {
    const contentPatch = {
      description: next.description,
      specs: next.specs,
      notes: next.notes,
      seoTitle: next.seoTitle,
      seoDescription: next.seoDescription,
      weightGrams: next.weightGrams,
      warrantyMonths: next.warrantyMonths,
      oemNumbers: next.oemNumbers.map((o) => ({
        raw: o.raw.trim(),
        normalized: normalizeCode(o.raw),
        ...(o.brand ? { brand: o.brand } : {}),
      })),
      crossNumbers: next.crossNumbers.map((c) => ({
        manufacturer: c.manufacturer,
        raw: c.raw.trim(),
        normalized: normalizeCode(c.raw),
      })),
      updatedAt: now,
    };
    if (content) await ctx.db.patch("productContent", content._id, contentPatch);
    else await ctx.db.insert("productContent", { productId, images: [], ...contentPatch });
  }
  if (changed.some((k) => (PRIVATE_FIELDS as readonly string[]).includes(k))) {
    const privatePatch = {
      costNetPara: next.costNetPara,
      supplierName: next.supplierName,
      supplierSku: next.supplierSku,
      internalNote: next.internalNote,
      updatedAt: now,
    };
    if (priv) await ctx.db.patch("productPrivate", priv._id, privatePatch);
    else await ctx.db.insert("productPrivate", { productId, ...privatePatch });
  }

  const codesChanged = changed.some((k) =>
    ["sku", "mpn", "ean", "oemNumbers", "crossNumbers", "manufacturerId"].includes(k),
  );
  if (codesChanged) {
    await replaceCodes(
      ctx,
      productId,
      buildCodeRows({ ...next, manufacturerName: manufacturer.name }),
      saved.categoryId,
      saved.active,
    );
  }
  if (fitmentsChanged) await replaceFitments(ctx, saved, next.fitments);
  if (!codesChanged || !fitmentsChanged) {
    if (
      product.categoryId !== saved.categoryId ||
      product.active !== saved.active ||
      product.manufacturerId !== saved.manufacturerId ||
      product.quality !== saved.quality
    ) {
      await syncDenormalized(ctx, saved);
    }
  }

  // Counters: remove the old contribution, add the new one.
  const before = countsFor(product);
  const after = countsFor(saved);
  if (product.categoryId !== saved.categoryId || product.manufacturerId !== saved.manufacturerId) {
    await adjustCounts(
      ctx,
      product.categoryId,
      product.manufacturerId,
      -before.product,
      -before.inStock,
    );
    await adjustCounts(ctx, saved.categoryId, saved.manufacturerId, after.product, after.inStock);
  } else {
    await adjustCounts(
      ctx,
      saved.categoryId,
      saved.manufacturerId,
      after.product - before.product,
      after.inStock - before.inStock,
    );
  }

  if (
    product.retailPricePara !== saved.retailPricePara ||
    (patch.costNetPara !== undefined && patch.costNetPara !== priv?.costNetPara)
  ) {
    await ctx.db.insert("priceChanges", {
      productId,
      oldRetailPara: product.retailPricePara,
      newRetailPara: saved.retailPricePara,
      ...(priv?.costNetPara !== undefined ? { oldCostNetPara: priv.costNetPara } : {}),
      ...(next.costNetPara !== undefined ? { newCostNetPara: next.costNetPara } : {}),
      reason: meta.priceReason ?? "manual",
      actor: meta.actor,
      ...(meta.importBatchId ? { importBatchId: meta.importBatchId } : {}),
      at: now,
    });
  }
  await recordMovement(ctx, productId, product.stockQty, saved.stockQty, {
    reason: meta.stockReason ?? "manual",
    actor: meta.actor,
    refType: meta.importBatchId ? "import" : "manual",
    ...(meta.importBatchId ? { importBatchId: meta.importBatchId } : {}),
  });
  await emitStockEvents(ctx, saved, product.stockQty, product.stockState, meta.actor);

  if (product.slug !== saved.slug) {
    await ctx.db.insert("redirects", {
      fromPath: `/deo/${product.slug}`,
      toPath: `/deo/${saved.slug}`,
      kind: "product",
      hits: 0,
    });
  }
  if (meta.emit) {
    await emitEvent(ctx, {
      type: "product.changed",
      aggregateType: "product",
      aggregateId: productId,
      payload: { kind: "catalog", productId, slug: saved.slug, fields: changed.slice(0, 40) },
      dedupeKey: `product.changed:${productId}:${now}`,
      actor: meta.actor,
    });
  }
  return changed;
}

export type StockChange = {
  reason: Doc<"stockMovements">["reason"];
  actor: Actor;
  refType?: Doc<"stockMovements">["refType"];
  refId?: string;
  note?: string;
};

/**
 * Moves stock by `delta` (clamped at 0) with a movement row, derived state, counters and
 * stock events. Returns the quantity actually moved (negative when taken).
 */
export async function applyStockDelta(
  ctx: MutationCtx,
  productId: Id<"products">,
  delta: number,
  change: StockChange,
): Promise<number> {
  if (!Number.isInteger(delta)) invalid("Količina mora biti ceo broj.", "delta");
  const product = await ctx.db.get("products", productId);
  if (!product) return notFound("Artikal ne postoji.");
  const settings = await getSettings(ctx);
  const qtyAfter = Math.min(LIMITS.maxQty, Math.max(0, product.stockQty + delta));
  if (qtyAfter === product.stockQty) return 0;
  const stockState = deriveStockState(
    { ...product, stockQty: qtyAfter },
    settings.commerce.lowStockDefault,
  );
  const now = Date.now();
  await ctx.db.patch("products", productId, { stockQty: qtyAfter, stockState, updatedAt: now });
  const saved = { ...product, stockQty: qtyAfter, stockState, updatedAt: now };
  await recordMovement(ctx, productId, product.stockQty, qtyAfter, change);
  const before = countsFor(product);
  const after = countsFor(saved);
  await adjustCounts(
    ctx,
    product.categoryId,
    product.manufacturerId,
    0,
    after.inStock - before.inStock,
  );
  await emitStockEvents(ctx, saved, product.stockQty, product.stockState, change.actor);
  return qtyAfter - product.stockQty;
}

/**
 * Hard delete (demo removal only): children, counters, cart lines. Order items keep their
 * snapshot fields; their `productId` is left dangling on purpose (history).
 */
export async function deleteProductHard(
  ctx: MutationCtx,
  productId: Id<"products">,
): Promise<void> {
  const product = await ctx.db.get("products", productId);
  if (!product) return;
  const counts = countsFor(product);
  await adjustCounts(
    ctx,
    product.categoryId,
    product.manufacturerId,
    -counts.product,
    -counts.inStock,
  );
  for (const row of await ctx.db
    .query("productContent")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(5)) {
    await ctx.db.delete("productContent", row._id);
  }
  for (const row of await ctx.db
    .query("productPrivate")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(5)) {
    await ctx.db.delete("productPrivate", row._id);
  }
  for (const row of await ctx.db
    .query("productCodes")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(500)) {
    await ctx.db.delete("productCodes", row._id);
  }
  for (const row of await ctx.db
    .query("fitments")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(500)) {
    await ctx.db.delete("fitments", row._id);
  }
  for (const row of await ctx.db
    .query("stockMovements")
    .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
    .take(500)) {
    await ctx.db.delete("stockMovements", row._id);
  }
  for (const row of await ctx.db
    .query("priceChanges")
    .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
    .take(500)) {
    await ctx.db.delete("priceChanges", row._id);
  }
  const subs = await ctx.db
    .query("backInStockSubscriptions")
    .withIndex("by_productId_and_status", (q) => q.eq("productId", productId))
    .take(500);
  for (const row of subs) await ctx.db.delete("backInStockSubscriptions", row._id);
  if (product.primaryImageId) await ctx.storage.delete(product.primaryImageId);
  await ctx.db.delete("products", productId);
}
