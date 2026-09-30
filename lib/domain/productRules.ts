/**
 * Product field rules shared by every write path (docs/IMPORT.md §K3): the Convex product
 * writer (manual editor, bulk actions, import commit) and the import row validator run the
 * same checks, so a row that passes the preview cannot fail on commit for a field rule.
 * Pure — shared by Next and Convex.
 */

export const PRODUCT_LIMITS = {
  sku: 64,
  name: 160,
  oem: 50,
  cross: 100,
  specs: 40,
  fitments: 200,
  description: 5_000,
  maxQty: 1_000_000,
  images: 12,
  lowStockThreshold: 10_000,
  leadTimeDays: 365,
  weightGrams: 1_000_000,
  ean: 14,
  mpn: 64,
} as const;

/** Largest accepted price (100 million RSD in para) — anything above is a typo. */
export const MAX_PRICE_PARA = 10_000_000_000;

export type ProductFieldIssue = { field: string; message: string };

export type ProductRuleInput = {
  sku?: string;
  name?: string;
  retailPricePara?: number;
  stockQty?: number;
  lowStockThreshold?: number;
  leadTimeDays?: number;
  costNetPara?: number;
  weightGrams?: number;
  oemCount?: number;
  crossCount?: number;
  specsCount?: number;
  fitmentCount?: number;
  description?: string;
  ean?: string;
  mpn?: string;
};

const isInt = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/**
 * Checks the fields that are present (undefined = not provided). Messages are Serbian and
 * name the field the way staff see it in the editor and in the import template.
 */
export function productFieldIssues(input: ProductRuleInput): ProductFieldIssue[] {
  const issues: ProductFieldIssue[] = [];
  const L = PRODUCT_LIMITS;
  if (input.sku !== undefined) {
    const sku = input.sku.trim();
    if (!sku || sku.length > L.sku)
      issues.push({ field: "sku", message: "Šifra artikla je obavezna (do 64 znaka)." });
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > L.name)
      issues.push({ field: "name", message: "Naziv je obavezan (do 160 znakova)." });
  }
  if (input.retailPricePara !== undefined && !isInt(input.retailPricePara, 0, MAX_PRICE_PARA))
    issues.push({ field: "retailPricePara", message: "Cena mora biti broj 0 ili veći." });
  if (input.stockQty !== undefined && !isInt(input.stockQty, 0, L.maxQty))
    issues.push({ field: "stockQty", message: "Količina mora biti ceo broj 0 ili veći." });
  if (
    input.lowStockThreshold !== undefined &&
    !isInt(input.lowStockThreshold, 0, L.lowStockThreshold)
  )
    issues.push({ field: "lowStockThreshold", message: "Prag zaliha je ceo broj od 0 do 10.000." });
  if (input.leadTimeDays !== undefined && !isInt(input.leadTimeDays, 0, L.leadTimeDays))
    issues.push({ field: "leadTimeDays", message: "Rok isporuke je ceo broj dana, od 0 do 365." });
  if (input.costNetPara !== undefined && !isInt(input.costNetPara, 0, MAX_PRICE_PARA))
    issues.push({ field: "costNetPara", message: "Nabavna cena mora biti broj 0 ili veći." });
  if (input.weightGrams !== undefined && !isInt(input.weightGrams, 0, L.weightGrams))
    issues.push({ field: "weightGrams", message: "Težina mora biti između 0 i 1.000 kg." });
  if ((input.oemCount ?? 0) > L.oem)
    issues.push({ field: "oemNumbers", message: "Najviše 50 OEM brojeva." });
  if ((input.crossCount ?? 0) > L.cross)
    issues.push({ field: "crossNumbers", message: "Najviše 100 zamenskih brojeva." });
  if ((input.specsCount ?? 0) > L.specs)
    issues.push({ field: "specs", message: "Najviše 40 tehničkih podataka." });
  if ((input.fitmentCount ?? 0) > L.fitments)
    issues.push({ field: "fitments", message: "Najviše 200 vozila po artiklu." });
  if ((input.description?.length ?? 0) > L.description)
    issues.push({ field: "description", message: "Opis je predugačak (do 5.000 znakova)." });
  if (input.ean !== undefined && input.ean !== "" && !/^\d{8,14}$/.test(input.ean.trim()))
    issues.push({ field: "ean", message: "EAN ima 8 do 14 cifara." });
  if (input.mpn !== undefined && input.mpn.trim().length > L.mpn)
    issues.push({ field: "mpn", message: "Broj proizvođača je predugačak (do 64 znaka)." });
  return issues;
}
