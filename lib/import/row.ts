/**
 * One import row: mapped raw cells → normalized product fields + errors and warnings
 * (docs/IMPORT.md §K3). The same function runs in the browser worker (preview) and in
 * Convex (staging), with the same reference data, so the preview and the commit agree.
 * Field rules come from `lib/domain/productRules.ts` (shared with the manual editor).
 * Empty cells mean „no change“ — an import never clears a stored value.
 * Pure.
 */
import { normalizeCode } from "../domain/codes";
import { MAX_PRICE_PARA, PRODUCT_LIMITS, productFieldIssues } from "../domain/productRules";
import { foldForSearch } from "../domain/search";
import type { ImportField, ImportMode } from "./fields";
import { FIELD_BY_KEY } from "./fields";
import { parseFitmentText, type FitmentRef, type VehicleIndex } from "./fitmentText";
import { levenshtein, normalizeHeader } from "./headers";
import {
  parseBool,
  parseMoney,
  parseWeight,
  parseWholeNumber,
  toPara,
  type NumberFormat,
} from "./numbers";

export type Quality = "original" | "oem" | "aftermarket";

export type CellValue = string | number | boolean | null;
export type RawRow = Partial<Record<ImportField, CellValue>>;

export type RefCategory = { id: string; name: string; slug: string; parentName?: string };
export type RefManufacturer = {
  id: string;
  name: string;
  slug: string;
  aliases: readonly string[];
};

export type ValueMaps = {
  /** normalizeHeader(value) → category id */
  category?: Readonly<Record<string, string>>;
  /** normalizeHeader(value) → manufacturer id, or "new" (create on commit) */
  manufacturer?: Readonly<Record<string, string>>;
};

export type RowContext = {
  mode: ImportMode;
  numberFormat: NumberFormat;
  /** Flag `12.990`-style cells when the file gave no evidence for the chosen format. */
  warnAmbiguous: boolean;
  vatRateBp: number;
  categories: readonly RefCategory[];
  manufacturers: readonly RefManufacturer[];
  vehicles: VehicleIndex;
  valueMaps?: ValueMaps;
};

export type NormalizedRow = {
  sku?: string;
  name?: string;
  categoryId?: string;
  categoryLabel?: string;
  manufacturerId?: string;
  manufacturerName?: string;
  /** The manufacturer does not exist yet and will be created on commit. */
  newManufacturer?: boolean;
  quality?: Quality;
  oemNumbers?: string[];
  mpn?: string;
  crossNumbers?: { manufacturer: string; raw: string }[];
  retailPricePara?: number;
  costNetPara?: number;
  stockQty?: number;
  leadTimeDays?: number;
  fitments?: FitmentRef[];
  description?: string;
  images?: string[];
  weightGrams?: number;
  ean?: string;
  active?: boolean;
  lowStockThreshold?: number;
};

export type RowIssue = { code: string; field?: ImportField; message: string };

export type RowResult = {
  data: NormalizedRow;
  errors: RowIssue[];
  warnings: RowIssue[];
  /** Unknown category value (for the „mapiranje vrednosti“ step), with suggestions. */
  unknownCategory?: { value: string; suggestions: string[] };
  unknownManufacturer?: string;
};

const STOCK_PRICE_FIELDS: ReadonlySet<ImportField> = new Set([
  "sku",
  "priceRetail",
  "priceNet",
  "cost",
  "stock",
  "leadTimeDays",
  "active",
]);

// Control characters except tab and new lines.
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function cleanText(value: CellValue | undefined, multiline = false): string {
  if (value === null || value === undefined) return "";
  const text = (typeof value === "number" ? numberText(value) : String(value))
    .normalize("NFC")
    .replace(CONTROL, "");
  return multiline
    ? text
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : text.replace(/\s+/g, " ").trim();
}

/** Integers without a trailing `.0`, other numbers as written by JS. */
function numberText(n: number): string {
  return Number.isInteger(n) ? n.toFixed(0) : String(n);
}

/** Multi-value cells: `;`, `|`, `,` or new lines — never `/` or spaces (they occur in codes). */
export function splitMulti(value: string): string[] {
  return value
    .split(/[;|,\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const QUALITY_WORDS: Readonly<Record<string, Quality>> = {
  original: "original",
  originalni: "original",
  orig: "original",
  vag: "original",
  oem: "oem",
  oe: "oem",
  aftermarket: "aftermarket",
  zamenski: "aftermarket",
  zamena: "aftermarket",
  am: "aftermarket",
};

function label(field: ImportField): string {
  return FIELD_BY_KEY[field].label;
}

/** Top-3 category names by closeness to the value (folded, Levenshtein + contained words). */
export function suggestCategories(value: string, categories: readonly RefCategory[]): string[] {
  const v = foldForSearch(value);
  const scored = categories.map((c) => {
    const n = foldForSearch(c.name);
    let score = levenshtein(v, n, 12);
    if (n.includes(v) || v.includes(n)) score -= 4;
    const shared = v.split(" ").filter((w) => w.length > 3 && n.includes(w.slice(0, 5))).length;
    score -= shared * 3;
    return { name: c.parentName ? `${c.parentName} › ${c.name}` : c.name, score };
  });
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => s.name);
}

function resolveCategory(
  raw: string,
  ctx: RowContext,
): { id: string; label: string } | { ambiguous: true } | null {
  const mapped = ctx.valueMaps?.category?.[normalizeHeader(raw)];
  if (mapped) {
    const c = ctx.categories.find((x) => x.id === mapped);
    if (c) return { id: c.id, label: c.name };
  }
  const parts = raw.split(/\s*(?:›|>|\/|\\)\s*/).filter(Boolean);
  const leaf = foldForSearch(parts[parts.length - 1] ?? raw);
  const parent = parts.length > 1 ? foldForSearch(parts[parts.length - 2]!) : undefined;
  const byName = ctx.categories.filter(
    (c) =>
      (foldForSearch(c.name) === leaf || c.slug === raw.trim().toLowerCase()) &&
      (!parent || foldForSearch(c.parentName ?? "") === parent),
  );
  if (byName.length === 1) return { id: byName[0]!.id, label: byName[0]!.name };
  if (byName.length > 1) return { ambiguous: true };
  return null;
}

function resolveManufacturer(raw: string, ctx: RowContext): RefManufacturer | "new" | null {
  const mapped = ctx.valueMaps?.manufacturer?.[normalizeHeader(raw)];
  if (mapped === "new") return "new";
  if (mapped) {
    const m = ctx.manufacturers.find((x) => x.id === mapped);
    if (m) return m;
  }
  const f = foldForSearch(raw);
  return (
    ctx.manufacturers.find(
      (m) =>
        foldForSearch(m.name) === f ||
        m.slug === f.replace(/ /g, "-") ||
        m.aliases.some((a) => foldForSearch(a) === f),
    ) ?? null
  );
}

/** `ATE 24.0125-0158.1` → manufacturer ATE; the longest known maker name wins. */
function parseCross(segment: string, ctx: RowContext): { manufacturer: string; raw: string } {
  const folded = foldForSearch(segment);
  let best: { name: string; words: number } | null = null;
  for (const m of ctx.manufacturers) {
    for (const n of [m.name, ...m.aliases]) {
      const fn = foldForSearch(n);
      if (fn && (folded === fn || folded.startsWith(`${fn} `))) {
        const words = fn.split(" ").length;
        if (!best || words > best.words) best = { name: m.name, words };
      }
    }
  }
  const tokens = segment.trim().split(/\s+/);
  if (best) return { manufacturer: best.name, raw: tokens.slice(best.words).join(" ") };
  if (tokens.length > 1 && !/\d/.test(tokens[0]!))
    return { manufacturer: tokens[0]!, raw: tokens.slice(1).join(" ") };
  return { manufacturer: "", raw: segment.trim() };
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateRow(raw: RawRow, ctx: RowContext): RowResult {
  const data: NormalizedRow = {};
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const result: RowResult = { data, errors, warnings };
  const uses = (field: ImportField) =>
    raw[field] !== undefined && (ctx.mode === "full" || STOCK_PRICE_FIELDS.has(field));
  const text = (field: ImportField, multiline = false) =>
    uses(field) ? cleanText(raw[field], multiline) : "";
  const ambiguous = (field: ImportField, cellText: string) => {
    if (ctx.warnAmbiguous)
      warnings.push({
        code: "AMBIGUOUS_NUMBER",
        field,
        message: `${label(field)}: „${cellText}“ je pročitano kao ${ctx.numberFormat === "sr" ? "srpski" : "engleski"} format broja — proverite.`,
      });
  };

  const sku = text("sku");
  if (sku) data.sku = sku;

  const name = text("name");
  if (name) data.name = name;

  const categoryText = text("category");
  if (categoryText) {
    const c = resolveCategory(categoryText, ctx);
    if (c && "id" in c) {
      data.categoryId = c.id;
      data.categoryLabel = c.label;
    } else {
      const suggestions = suggestCategories(categoryText, ctx.categories);
      result.unknownCategory = { value: categoryText, suggestions };
      errors.push({
        code: c ? "CATEGORY_AMBIGUOUS" : "CATEGORY_UNKNOWN",
        field: "category",
        message: c
          ? `Kategorija „${categoryText}“ postoji u više grupa — navedite i grupu (npr. „Kočnice › Diskovi“).`
          : `Kategorija „${categoryText}“ ne postoji. Najsličnije: ${suggestions.join(", ")}.`,
      });
    }
  }

  const manufacturerText = text("manufacturer");
  if (manufacturerText) {
    const m = resolveManufacturer(manufacturerText, ctx);
    if (m === "new" || m === null) {
      data.manufacturerName = manufacturerText;
      data.newManufacturer = true;
      result.unknownManufacturer = manufacturerText;
      warnings.push({
        code: "MANUFACTURER_NEW",
        field: "manufacturer",
        message: `Proizvođač „${manufacturerText}“ ne postoji — biće napravljen pri uvozu.`,
      });
    } else {
      data.manufacturerId = m.id;
      data.manufacturerName = m.name;
    }
  }

  const qualityText = text("quality");
  if (qualityText) {
    const q = QUALITY_WORDS[foldForSearch(qualityText).split(" ")[0] ?? ""];
    if (q) data.quality = q;
    else
      warnings.push({
        code: "QUALITY_UNKNOWN",
        field: "quality",
        message: `Kvalitet „${qualityText}“ nije prepoznat (original, oem, aftermarket) — koristi se podrazumevani.`,
      });
  }

  const oemText = text("oem", true);
  if (oemText) {
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const code of splitMulti(oemText)) {
      const n = normalizeCode(code);
      if (n.length < 4 || n.length > 25) {
        warnings.push({
          code: "CODE_INVALID",
          field: "oem",
          message: `OEM broj „${code}“ je preskočen (4–25 znakova).`,
        });
        continue;
      }
      if (seen.has(n)) continue;
      seen.add(n);
      kept.push(code);
    }
    if (kept.length > 0) data.oemNumbers = kept;
  }

  const mpn = text("mpn");
  if (mpn) data.mpn = mpn;

  const crossText = text("cross", true);
  if (crossText) {
    const list = splitMulti(crossText)
      .map((s) => parseCross(s, ctx))
      .filter((c) => {
        const n = normalizeCode(c.raw);
        if (n.length >= 4 && n.length <= 25) return true;
        warnings.push({
          code: "CODE_INVALID",
          field: "cross",
          message: `Zamenski broj „${c.raw}“ je preskočen (4–25 znakova).`,
        });
        return false;
      });
    if (list.length > 0) data.crossNumbers = list;
  }

  if (uses("priceRetail") && cleanText(raw.priceRetail) !== "") {
    const p = parseMoney(raw.priceRetail, ctx.numberFormat);
    if (p.ok) {
      data.retailPricePara = p.para;
      if (p.ambiguous) ambiguous("priceRetail", cleanText(raw.priceRetail));
    } else
      errors.push({
        code: p.reason === "negative" ? "PRICE_NEGATIVE" : "PRICE_INVALID",
        field: "priceRetail",
        message:
          p.reason === "negative"
            ? "Cena ne može biti negativna."
            : `Cena „${cleanText(raw.priceRetail)}“ nije ispravan broj.`,
      });
  }
  if (data.retailPricePara === undefined && uses("priceNet") && cleanText(raw.priceNet) !== "") {
    const p = parseMoney(raw.priceNet, ctx.numberFormat);
    if (p.ok) {
      data.retailPricePara = Math.round((p.para * (10_000 + ctx.vatRateBp)) / 10_000);
      warnings.push({
        code: "PRICE_FROM_NET",
        field: "priceNet",
        message: `MP cena je izračunata iz VP cene (+${ctx.vatRateBp / 100} % PDV).`,
      });
      if (p.ambiguous) ambiguous("priceNet", cleanText(raw.priceNet));
    } else
      errors.push({
        code: p.reason === "negative" ? "PRICE_NEGATIVE" : "PRICE_INVALID",
        field: "priceNet",
        message:
          p.reason === "negative"
            ? "Cena ne može biti negativna."
            : `VP cena „${cleanText(raw.priceNet)}“ nije ispravan broj.`,
      });
  }
  if (data.retailPricePara === 0)
    warnings.push({
      code: "PRICE_ZERO",
      field: "priceRetail",
      message: "Cena je 0 RSD — kupci će videti „cena na upit“.",
    });
  if (data.retailPricePara !== undefined && data.retailPricePara > MAX_PRICE_PARA) {
    errors.push({
      code: "PRICE_INVALID",
      field: "priceRetail",
      message: "Cena je veća od 100 miliona dinara — proverite.",
    });
    delete data.retailPricePara;
  }

  if (uses("cost") && cleanText(raw.cost) !== "") {
    const p = parseMoney(raw.cost, ctx.numberFormat);
    if (p.ok) {
      data.costNetPara = p.para;
      if (p.ambiguous) ambiguous("cost", cleanText(raw.cost));
    } else
      errors.push({
        code: "COST_INVALID",
        field: "cost",
        message: `Nabavna cena „${cleanText(raw.cost)}“ nije ispravan broj 0 ili veći.`,
      });
  }

  const whole = (
    field: "stock" | "leadTimeDays" | "lowStockThreshold",
    key: "stockQty" | "leadTimeDays" | "lowStockThreshold",
  ) => {
    if (!uses(field) || cleanText(raw[field]) === "") return;
    const n = parseWholeNumber(raw[field], ctx.numberFormat);
    if (n.ok) data[key] = n.value;
    else
      errors.push({
        code: field === "stock" && n.reason === "negative" ? "STOCK_NEGATIVE" : "NUMBER_INVALID",
        field,
        message:
          n.reason === "negative"
            ? `${label(field)} ne može biti negativna (${cleanText(raw[field])}).`
            : `${label(field)}: „${cleanText(raw[field])}“ nije ceo broj.`,
      });
  };
  whole("stock", "stockQty");
  whole("leadTimeDays", "leadTimeDays");
  whole("lowStockThreshold", "lowStockThreshold");

  const fitmentText = text("fitment", true);
  if (fitmentText) {
    const parsed = parseFitmentText(ctx.vehicles, fitmentText);
    if (parsed.fitments.length > 0) data.fitments = parsed.fitments;
    if (parsed.unmatched.length > 0)
      warnings.push({
        code: "FITMENT_UNMATCHED",
        field: "fitment",
        message: `Vozila nisu prepoznata: ${parsed.unmatched.slice(0, 5).join("; ")}${parsed.unmatched.length > 5 ? " …" : ""}.`,
      });
  }

  const description = text("description", true);
  if (description) data.description = description;

  const imagesText = text("images", true);
  if (imagesText) {
    const urls = imagesText
      .split(/[;\s|]+|,(?=\s*https?:)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const good = [...new Set(urls.filter(isHttpUrl))];
    const bad = urls.filter((u) => !isHttpUrl(u));
    if (bad.length > 0)
      warnings.push({
        code: "IMAGE_URL_INVALID",
        field: "images",
        message: `Adresa slike nije ispravna i biće preskočena: ${bad.slice(0, 3).join(", ")}.`,
      });
    if (good.length > PRODUCT_LIMITS.images)
      warnings.push({
        code: "IMAGES_TOO_MANY",
        field: "images",
        message: "Više od 12 slika — uvoze se prvih 12.",
      });
    if (good.length > 0) data.images = good.slice(0, PRODUCT_LIMITS.images);
  }

  if (uses("weight") && cleanText(raw.weight) !== "") {
    const w = parseWeight(raw.weight, ctx.numberFormat);
    if (w.ok) data.weightGrams = w.grams;
    else
      errors.push({
        code: "WEIGHT_INVALID",
        field: "weight",
        message: `Težina „${cleanText(raw.weight)}“ nije ispravna.`,
      });
  }

  const ean = text("ean").replace(/\s/g, "");
  if (ean) data.ean = ean;

  if (uses("active") && cleanText(raw.active) !== "") {
    const b = parseBool(raw.active);
    if (b.ok) data.active = b.value;
    else
      warnings.push({
        code: "ACTIVE_UNKNOWN",
        field: "active",
        message: `„${cleanText(raw.active)}“ u koloni Aktivan nije da/ne — status se ne menja.`,
      });
  }

  // Shared product rules (same checks as the editor and the product writer).
  for (const issue of productFieldIssues({
    ...(data.sku !== undefined ? { sku: data.sku } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: data.lowStockThreshold } : {}),
    ...(data.leadTimeDays !== undefined ? { leadTimeDays: data.leadTimeDays } : {}),
    ...(data.stockQty !== undefined ? { stockQty: data.stockQty } : {}),
    ...(data.weightGrams !== undefined ? { weightGrams: data.weightGrams } : {}),
    oemCount: data.oemNumbers?.length ?? 0,
    crossCount: data.crossNumbers?.length ?? 0,
    fitmentCount: data.fitments?.length ?? 0,
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.ean !== undefined ? { ean: data.ean } : {}),
    ...(data.mpn !== undefined ? { mpn: data.mpn } : {}),
  })) {
    const field = RULE_FIELD[issue.field];
    errors.push({ code: "RULE", ...(field ? { field } : {}), message: issue.message });
  }

  if (!data.sku && !(ctx.mode === "full" && data.oemNumbers && data.manufacturerId))
    errors.push({ code: "SKU_MISSING", field: "sku", message: "Nedostaje šifra artikla." });

  return result;
}

const RULE_FIELD: Readonly<Record<string, ImportField>> = {
  sku: "sku",
  name: "name",
  stockQty: "stock",
  lowStockThreshold: "lowStockThreshold",
  leadTimeDays: "leadTimeDays",
  weightGrams: "weight",
  oemNumbers: "oem",
  crossNumbers: "cross",
  fitments: "fitment",
  description: "description",
  ean: "ean",
  mpn: "mpn",
};

/** Extra checks for a row that will create a product (known only after matching). */
export function createIssues(data: NormalizedRow): RowIssue[] {
  const issues: RowIssue[] = [];
  if (!data.sku)
    issues.push({
      code: "SKU_MISSING",
      field: "sku",
      message: "Za nov artikal je potrebna šifra.",
    });
  if (!data.name)
    issues.push({
      code: "NAME_MISSING",
      field: "name",
      message: "Za nov artikal je potreban naziv.",
    });
  if (!data.categoryId)
    issues.push({
      code: "CATEGORY_MISSING",
      field: "category",
      message: "Za nov artikal je potrebna kategorija.",
    });
  if (!data.manufacturerId && !data.newManufacturer)
    issues.push({
      code: "MANUFACTURER_MISSING",
      field: "manufacturer",
      message: "Za nov artikal je potreban proizvođač.",
    });
  if (data.retailPricePara === undefined)
    issues.push({
      code: "PRICE_MISSING",
      field: "priceRetail",
      message: "Za nov artikal je potrebna MP cena.",
    });
  return issues;
}

/** Dinars → para, re-exported for callers that build rows by hand (tests, fixtures). */
export { toPara };
