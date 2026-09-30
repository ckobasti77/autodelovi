/**
 * Import server model (docs/IMPORT.md §K3–K4): reference data for the shared row
 * validator, product matching (SKU, then OEM + manufacturer), the per-field diff against
 * the stored product, and the patch/input handed to `productWriter` on commit.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeCode } from "../../lib/domain/codes";
import { slugifySr } from "../../lib/domain/slug";
import { productFieldsLabel } from "../../lib/i18n/sr/auditLabels";
import {
  buildVehicleIndex,
  type VehicleIndex,
  type VehicleRef,
} from "../../lib/import/fitmentText";
import type { ImportMode } from "../../lib/import/fields";
import type { RefCategory, RefManufacturer, RowContext, RowIssue } from "../../lib/import/row";
import type { NumberFormat } from "../../lib/import/numbers";
import type { ImportRowData } from "./importValidators";
import type { FitmentInput, ProductInput, ProductPatch } from "./productWriter";
import { getSettings } from "./settings";

export type ImportReference = {
  categories: RefCategory[];
  manufacturers: RefManufacturer[];
  vehicles: VehicleRef;
  vehicleIndex: VehicleIndex;
  vatRateBp: number;
};

/** Every table here is small reference data (tens to a few hundred rows). */
export async function loadImportReference(ctx: QueryCtx): Promise<ImportReference> {
  const categories = await ctx.db.query("categories").take(1_000);
  const byId = new Map(categories.map((c) => [c._id, c]));
  const manufacturers = await ctx.db.query("manufacturers").take(2_000);
  const brands = await ctx.db.query("vehicleBrands").take(200);
  const models = await ctx.db.query("vehicleModels").take(1_000);
  const generations = await ctx.db.query("vehicleGenerations").take(2_000);
  const engines = await ctx.db.query("engines").take(1_000);
  const links = await ctx.db.query("generationEngines").take(8_000);
  const settings = await getSettings(ctx);
  const vehicles: VehicleRef = {
    brands: brands.map((b) => ({ id: b._id, name: b.name, aliases: b.aliases })),
    models: models.map((m) => ({
      id: m._id,
      brandId: m.brandId,
      name: m.name,
      aliases: m.aliases,
    })),
    generations: generations.map((g) => ({
      id: g._id,
      brandId: g.brandId,
      modelId: g.modelId,
      name: g.name,
      aliases: g.aliases,
      yearFrom: g.yearFrom,
      ...(g.yearTo !== undefined ? { yearTo: g.yearTo } : {}),
    })),
    engines: engines.map((e) => ({ id: e._id, name: e.name, codes: e.codes })),
    links: links.map((l) => ({ generationId: l.generationId, engineId: l.engineId })),
  };
  return {
    categories: categories
      .filter((c) => c.kind !== "system")
      .map((c) => {
        const parent = c.parentId ? byId.get(c.parentId) : undefined;
        return {
          id: c._id,
          name: c.name,
          slug: c.slug,
          ...(parent ? { parentName: parent.name } : {}),
        };
      }),
    manufacturers: manufacturers.map((m) => ({
      id: m._id,
      name: m.name,
      slug: m.slug,
      aliases: m.aliases,
    })),
    vehicles,
    vehicleIndex: buildVehicleIndex(vehicles),
    vatRateBp: settings.commerce.vatRateBp,
  };
}

export function rowContext(
  ref: ImportReference,
  batch: Pick<Doc<"importBatches">, "mode" | "numberFormat" | "warnAmbiguous" | "valueMaps">,
): RowContext {
  return {
    mode: batch.mode as ImportMode,
    numberFormat: batch.numberFormat as NumberFormat,
    warnAmbiguous: batch.warnAmbiguous ?? false,
    vatRateBp: ref.vatRateBp,
    categories: ref.categories,
    manufacturers: ref.manufacturers,
    vehicles: ref.vehicleIndex,
    ...(batch.valueMaps ? { valueMaps: batch.valueMaps } : {}),
  };
}

export type Match =
  | { product: Doc<"products">; matchKey: "sku" | "oem_manufacturer"; warning?: RowIssue }
  | { product: null; error?: RowIssue };

/** SKU first; in full mode an OEM number + manufacturer that points at exactly one product. */
export async function matchProduct(
  ctx: QueryCtx,
  data: ImportRowData,
  mode: ImportMode,
): Promise<Match> {
  if (data.sku) {
    const bySku = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", data.sku!))
      .first();
    if (bySku) return { product: bySku, matchKey: "sku" };
  }
  if (mode !== "full" || !data.oemNumbers?.length || !data.manufacturerId) return { product: null };
  const code = normalizeCode(data.oemNumbers[0]!);
  const codes = await ctx.db
    .query("productCodes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .take(50);
  const ids = [...new Set(codes.filter((c) => c.kind === "oem").map((c) => c.productId))];
  const candidates: Doc<"products">[] = [];
  for (const id of ids) {
    const p = await ctx.db.get("products", id);
    if (p && p.manufacturerId === data.manufacturerId && p.deletedAt === undefined)
      candidates.push(p);
  }
  if (candidates.length > 1) {
    return {
      product: null,
      error: {
        code: "OEM_AMBIGUOUS",
        field: "oem",
        message: "Više proizvoda sa istim OEM brojem i proizvođačem — navedite šifru artikla.",
      },
    };
  }
  if (candidates.length === 1) {
    const product = candidates[0]!;
    return {
      product,
      matchKey: "oem_manufacturer",
      ...(data.sku && data.sku !== product.sku
        ? {
            warning: {
              code: "SKU_CHANGED",
              field: "sku",
              message: `Artikal ${product.sku} je pronađen po OEM broju i proizvođaču; šifra se menja u ${data.sku}.`,
            },
          }
        : {}),
    };
  }
  return { product: null };
}

export type CurrentProduct = {
  product: Doc<"products">;
  content: Doc<"productContent"> | null;
  priv: Doc<"productPrivate"> | null;
  fitments: FitmentInput[] | null;
};

/** Loads only the child documents the mapped fields need (fewer reads per staged row). */
export async function loadCurrent(
  ctx: QueryCtx,
  product: Doc<"products">,
  data: ImportRowData,
): Promise<CurrentProduct> {
  const needsContent =
    data.oemNumbers !== undefined ||
    data.crossNumbers !== undefined ||
    data.description !== undefined ||
    data.weightGrams !== undefined;
  const needsPrivate = data.costNetPara !== undefined;
  const content = needsContent
    ? await ctx.db
        .query("productContent")
        .withIndex("by_productId", (q) => q.eq("productId", product._id))
        .unique()
    : null;
  const priv = needsPrivate
    ? await ctx.db
        .query("productPrivate")
        .withIndex("by_productId", (q) => q.eq("productId", product._id))
        .unique()
    : null;
  let fitments: FitmentInput[] | null = null;
  if (data.fitments !== undefined) {
    const rows = await ctx.db
      .query("fitments")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .take(300);
    fitments = rows.map((f) => ({
      brandId: f.brandId,
      modelId: f.modelId,
      generationId: f.generationId,
      ...(f.engineId ? { engineId: f.engineId } : {}),
      ...(f.yearFrom !== undefined ? { yearFrom: f.yearFrom } : {}),
      ...(f.yearTo !== undefined ? { yearTo: f.yearTo } : {}),
      ...(f.note ? { note: f.note } : {}),
    }));
  }
  return { product, content, priv, fitments };
}

const fitmentKey = (f: {
  generationId: string;
  engineId?: string;
  yearFrom?: number;
  yearTo?: number;
}) => `${f.generationId}|${f.engineId ?? ""}|${f.yearFrom ?? ""}|${f.yearTo ?? ""}`;

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export type Diff = {
  patch: ProductPatch;
  changed: string[];
  /** Previous values of the changed fields (`null` = the field was empty). */
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

/**
 * Compares the mapped fields with the stored product. Unmapped or empty fields never
 * appear in the patch (an import does not clear values). `manufacturerId` of a manufacturer
 * that is created on commit is passed in `newManufacturerId`.
 */
export function diffProduct(
  cur: CurrentProduct,
  data: ImportRowData,
  newManufacturerId?: Id<"manufacturers">,
): Diff {
  const p = cur.product;
  const patch: ProductPatch = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const set = <K extends keyof ProductPatch>(key: K, next: ProductPatch[K], prev: unknown) => {
    patch[key] = next;
    before[key] = prev === undefined ? null : prev;
    after[key] = next === undefined ? null : next;
  };

  if (data.sku !== undefined && data.sku !== p.sku) set("sku", data.sku, p.sku);
  if (data.name !== undefined && data.name !== p.name) set("name", data.name, p.name);
  if (data.categoryId !== undefined && data.categoryId !== p.categoryId)
    set("categoryId", data.categoryId, p.categoryId);
  const manufacturerId = data.manufacturerId ?? newManufacturerId;
  if (manufacturerId !== undefined && manufacturerId !== p.manufacturerId)
    set("manufacturerId", manufacturerId, p.manufacturerId);
  else if (data.newManufacturer && !newManufacturerId)
    set("manufacturerId", undefined, p.manufacturerId);
  if (data.quality !== undefined && data.quality !== p.quality)
    set("quality", data.quality, p.quality);
  if (data.mpn !== undefined && data.mpn !== (p.mpn ?? "")) set("mpn", data.mpn, p.mpn);
  if (data.ean !== undefined && data.ean !== (p.ean ?? "")) set("ean", data.ean, p.ean);
  if (data.retailPricePara !== undefined && data.retailPricePara !== p.retailPricePara)
    set("retailPricePara", data.retailPricePara, p.retailPricePara);
  if (data.stockQty !== undefined && data.stockQty !== p.stockQty)
    set("stockQty", data.stockQty, p.stockQty);
  if (data.leadTimeDays !== undefined && data.leadTimeDays !== p.leadTimeDays)
    set("leadTimeDays", data.leadTimeDays, p.leadTimeDays);
  if (data.lowStockThreshold !== undefined && data.lowStockThreshold !== p.lowStockThreshold)
    set("lowStockThreshold", data.lowStockThreshold, p.lowStockThreshold);
  if (data.active !== undefined && data.active !== p.active) set("active", data.active, p.active);

  if (data.costNetPara !== undefined && data.costNetPara !== cur.priv?.costNetPara)
    set("costNetPara", data.costNetPara, cur.priv?.costNetPara);

  const content = cur.content;
  if (data.description !== undefined && data.description !== (content?.description ?? ""))
    set("description", data.description, content?.description);
  if (data.weightGrams !== undefined && data.weightGrams !== content?.weightGrams)
    set("weightGrams", data.weightGrams, content?.weightGrams);
  if (data.oemNumbers !== undefined) {
    const prev = content?.oemNumbers ?? [];
    if (
      !sameList(
        data.oemNumbers.map(normalizeCode),
        prev.map((o) => o.normalized),
      )
    ) {
      set(
        "oemNumbers",
        data.oemNumbers.map((raw) => ({ raw })),
        prev.map((o) => ({ raw: o.raw, ...(o.brand ? { brand: o.brand } : {}) })),
      );
    }
  }
  if (data.crossNumbers !== undefined) {
    const prev = content?.crossNumbers ?? [];
    const key = (c: { manufacturer: string; raw: string }) =>
      `${c.manufacturer.toLowerCase()}|${normalizeCode(c.raw)}`;
    if (!sameList(data.crossNumbers.map(key), prev.map(key))) {
      set(
        "crossNumbers",
        data.crossNumbers,
        prev.map((c) => ({ manufacturer: c.manufacturer, raw: c.raw })),
      );
    }
  }
  if (data.fitments !== undefined && cur.fitments) {
    const next = [...data.fitments.map(fitmentKey)].sort();
    const prev = [...cur.fitments.map(fitmentKey)].sort();
    if (!sameList(next, prev)) set("fitments", data.fitments as FitmentInput[], cur.fitments);
  }
  return { patch, changed: Object.keys(patch), before, after };
}

/** Full product input for a created row (`createIssues` already guaranteed the essentials). */
export function createInput(
  data: ImportRowData,
  manufacturerId: Id<"manufacturers">,
): ProductInput {
  return {
    sku: data.sku!,
    name: data.name!,
    categoryId: data.categoryId!,
    manufacturerId,
    ...(data.quality ? { quality: data.quality } : {}),
    ...(data.mpn ? { mpn: data.mpn } : {}),
    ...(data.ean ? { ean: data.ean } : {}),
    oemNumbers: (data.oemNumbers ?? []).map((raw) => ({ raw })),
    crossNumbers: data.crossNumbers ?? [],
    retailPricePara: data.retailPricePara!,
    stockQty: data.stockQty ?? 0,
    ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: data.lowStockThreshold } : {}),
    ...(data.leadTimeDays !== undefined ? { leadTimeDays: data.leadTimeDays } : {}),
    allowBackorder: false,
    universal: false,
    fitments: (data.fitments ?? []) as FitmentInput[],
    ...(data.description ? { description: data.description } : {}),
    specs: [],
    ...(data.weightGrams !== undefined ? { weightGrams: data.weightGrams } : {}),
    ...(data.costNetPara !== undefined ? { costNetPara: data.costNetPara } : {}),
    active: data.active ?? true,
    isDemo: false,
    source: "import",
  };
}

/** Finds a manufacturer by exact name or creates it (source `import`, aftermarket). */
export async function ensureManufacturer(
  ctx: MutationCtx,
  name: string,
): Promise<Id<"manufacturers">> {
  const trimmed = name.trim();
  const existing = await ctx.db
    .query("manufacturers")
    .withIndex("by_name", (q) => q.eq("name", trimmed))
    .first();
  if (existing) return existing._id;
  const base = slugifySr(trimmed) || "proizvodjac";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const hit = await ctx.db
      .query("manufacturers")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!hit) break;
    slug = `${base}-${i}`;
  }
  return await ctx.db.insert("manufacturers", {
    name: trimmed,
    slug,
    aliases: [],
    isVagGenuine: false,
    defaultQuality: "aftermarket",
    active: true,
    productCount: 0,
    source: "import",
  });
}

/** Import-history entries for the product editor (Istorija). */
export function importHistorySummary(
  change: Doc<"importChanges">,
  batch: Doc<"importBatches"> | null,
): string {
  const file = batch?.fileName ?? "uvoz";
  if (change.action === "create") return `Napravljen uvozom (${file})`;
  if (change.action === "deactivate") return `Deaktiviran uvozom — nije bio u fajlu (${file})`;
  return `Uvoz ${file}: ${productFieldsLabel(Object.keys(change.before ?? {}))}${change.rolledBack && !change.rollbackSkippedReason ? " (poništeno)" : ""}`;
}
