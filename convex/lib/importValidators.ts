/**
 * Validators for the import tables and functions (docs/IMPORT.md §K4, DATA-MODEL §C10).
 * `importRowDataV` mirrors `NormalizedRow` in lib/import/row.ts with Convex ids.
 */
import { v, type Infer } from "convex/values";

import { qualityV } from "./validators";

export const fitmentRefV = v.object({
  brandId: v.id("vehicleBrands"),
  modelId: v.id("vehicleModels"),
  generationId: v.id("vehicleGenerations"),
  engineId: v.optional(v.id("engines")),
  yearFrom: v.optional(v.number()),
  yearTo: v.optional(v.number()),
});

export const importRowDataV = v.object({
  sku: v.optional(v.string()),
  name: v.optional(v.string()),
  categoryId: v.optional(v.id("categories")),
  categoryLabel: v.optional(v.string()),
  manufacturerId: v.optional(v.id("manufacturers")),
  manufacturerName: v.optional(v.string()),
  newManufacturer: v.optional(v.boolean()),
  quality: v.optional(qualityV),
  oemNumbers: v.optional(v.array(v.string())),
  mpn: v.optional(v.string()),
  crossNumbers: v.optional(v.array(v.object({ manufacturer: v.string(), raw: v.string() }))),
  retailPricePara: v.optional(v.number()),
  costNetPara: v.optional(v.number()),
  stockQty: v.optional(v.number()),
  leadTimeDays: v.optional(v.number()),
  fitments: v.optional(v.array(fitmentRefV)),
  description: v.optional(v.string()),
  images: v.optional(v.array(v.string())),
  weightGrams: v.optional(v.number()),
  ean: v.optional(v.string()),
  active: v.optional(v.boolean()),
  lowStockThreshold: v.optional(v.number()),
});
export type ImportRowData = Infer<typeof importRowDataV>;

export const cellV = v.union(v.string(), v.number(), v.boolean(), v.null());
export const cellsV = v.record(v.string(), cellV);

export const issueV = v.object({
  code: v.string(),
  field: v.optional(v.string()),
  message: v.string(),
});

export const mappingEntryV = v.object({
  column: v.number(),
  header: v.string(),
  field: v.string(),
});

export const importModeV = v.union(v.literal("full"), v.literal("stock_price"));
export const numberFormatV = v.union(v.literal("sr"), v.literal("en"));
export const importFormatV = v.union(v.literal("xlsx"), v.literal("xls"), v.literal("csv"));
export const importStatusV = v.union(
  v.literal("staging"),
  v.literal("validated"),
  v.literal("committing"),
  v.literal("committed"),
  v.literal("failed"),
  v.literal("rolling_back"),
  v.literal("rolled_back"),
  v.literal("cancelled"),
);
export const rowActionV = v.union(
  v.literal("create"),
  v.literal("update"),
  v.literal("unchanged"),
  v.literal("skip"),
  v.literal("error"),
);
export type RowAction = Infer<typeof rowActionV>;

export const valueMapsV = v.object({
  category: v.record(v.string(), v.id("categories")),
  manufacturer: v.record(v.string(), v.union(v.id("manufacturers"), v.literal("new"))),
});
