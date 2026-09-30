/**
 * Cell value parsing for imports (docs/IMPORT.md §K3): Serbian (`1.234,56`) and English
 * (`1,234.56`) number formats, money → integer para (half-up), quantities, booleans and
 * weights. Cells arrive as strings (CSV, formatted xlsx text) or numbers (xlsx raw values).
 * Pure.
 */

export type NumberFormat = "sr" | "en";

export type ParsedNumber =
  { ok: true; value: number; ambiguous: boolean } | { ok: false; reason: "empty" | "invalid" };

const CURRENCY = /\b(rsd|din\.?|dinara|eur|€)\b|[€]/gi;
// Plain, no-break, narrow no-break and thin spaces used as thousand separators.
const SPACES = /[\s   ]/g;

/**
 * Parses a number. With `sr` the comma is the decimal separator and dots group thousands;
 * `en` is the reverse. A lone separator followed by exactly three digits (`12.990` in `en`,
 * `12,990` in `sr`) is read in the chosen format but flagged `ambiguous`.
 */
export function parseNumber(cell: unknown, format: NumberFormat): ParsedNumber {
  if (typeof cell === "number") {
    return Number.isFinite(cell)
      ? { ok: true, value: cell, ambiguous: false }
      : { ok: false, reason: "invalid" };
  }
  if (cell === null || cell === undefined) return { ok: false, reason: "empty" };
  let text = String(cell).replace(CURRENCY, "").replace(SPACES, "").replace(/[−–]/g, "-");
  if (text === "") return { ok: false, reason: "empty" };
  if (!/^[-+]?[\d.,']+$/.test(text)) return { ok: false, reason: "invalid" };
  text = text.replace(/'/g, "");
  const decimal = format === "sr" ? "," : ".";
  const group = format === "sr" ? "." : ",";
  let ambiguous = false;

  const decimals = text.split(decimal).length - 1;
  if (decimals > 1) return { ok: false, reason: "invalid" };
  const [intPartRaw, fracPart = ""] = text.split(decimal) as [string, string?];
  let intPart = intPartRaw;
  if (intPart.includes(group)) {
    const groups = intPart.replace(/^[-+]/, "").split(group);
    // Thousand groups must be exactly three digits after the first.
    if (groups.slice(1).some((g) => g.length !== 3) || groups[0] === "") {
      return { ok: false, reason: "invalid" };
    }
    if (groups.length === 2 && decimals === 0) ambiguous = true;
    intPart = intPart.split(group).join("");
  } else if (decimals === 1 && fracPart.length === 3 && !intPart.includes(group)) {
    // `12,990` in sr = 12.99 but may be twelve thousand; flag it.
    ambiguous = true;
  }
  if (fracPart.includes(group)) return { ok: false, reason: "invalid" };
  const normalized = `${intPart}${decimals ? `.${fracPart}` : ""}`;
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return { ok: false, reason: "invalid" };
  const value = Number(normalized);
  return Number.isFinite(value) ? { ok: true, value, ambiguous } : { ok: false, reason: "invalid" };
}

export type FormatEvidence = { format: NumberFormat; sr: number; en: number };

/**
 * Chooses the number format from sample cells: a cell counts as evidence when it parses in
 * one format only, or unambiguously in exactly one (`1.234,56`, `12,5` → sr; `1,234.56`,
 * `12.5` → en). Ties keep Serbian. Numeric xlsx cells carry no evidence.
 */
export function detectNumberFormat(cells: readonly unknown[]): FormatEvidence {
  let sr = 0;
  let en = 0;
  for (const cell of cells) {
    if (typeof cell !== "string" || !/[.,]/.test(cell)) continue;
    const a = parseNumber(cell, "sr");
    const b = parseNumber(cell, "en");
    const srOk = a.ok && !a.ambiguous;
    const enOk = b.ok && !b.ambiguous;
    if (srOk && !enOk) sr++;
    else if (enOk && !srOk) en++;
  }
  return { format: en > sr ? "en" : "sr", sr, en };
}

/** Dinars (possibly with decimals) → integer para, half-up. */
export function toPara(dinars: number): number {
  return Math.round(dinars * 100 + (dinars >= 0 ? 1e-9 : -1e-9));
}

export type ParsedMoney =
  | { ok: true; para: number; ambiguous: boolean }
  | { ok: false; reason: "empty" | "invalid" | "negative" };

export function parseMoney(cell: unknown, format: NumberFormat): ParsedMoney {
  const n = parseNumber(cell, format);
  if (!n.ok) return n;
  if (n.value < 0) return { ok: false, reason: "negative" };
  return { ok: true, para: toPara(n.value), ambiguous: n.ambiguous };
}

export type ParsedInt =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid" | "negative" | "fraction" };

/** Whole non-negative number (stock, days, thresholds). `12,0` / `12.00` are accepted. */
export function parseWholeNumber(cell: unknown, format: NumberFormat): ParsedInt {
  const n = parseNumber(cell, format);
  if (!n.ok) return n;
  if (n.value < 0) return { ok: false, reason: "negative" };
  if (!Number.isInteger(n.value)) {
    // `1.000` in en is 1.0 — integral; a real fraction is refused.
    if (Math.abs(n.value - Math.round(n.value)) > 1e-9) return { ok: false, reason: "fraction" };
  }
  return { ok: true, value: Math.round(n.value) };
}

const TRUE = new Set([
  "da",
  "d",
  "yes",
  "y",
  "true",
  "1",
  "aktivan",
  "aktivno",
  "active",
  "x",
  "✓",
]);
const FALSE = new Set(["ne", "n", "no", "false", "0", "neaktivan", "neaktivno", "inactive", "-"]);

export type ParsedBool = { ok: true; value: boolean } | { ok: false; reason: "empty" | "invalid" };

export function parseBool(cell: unknown): ParsedBool {
  if (typeof cell === "boolean") return { ok: true, value: cell };
  if (typeof cell === "number")
    return cell === 1 || cell === 0
      ? { ok: true, value: cell === 1 }
      : { ok: false, reason: "invalid" };
  const text = String(cell ?? "")
    .trim()
    .toLowerCase();
  if (!text) return { ok: false, reason: "empty" };
  if (TRUE.has(text)) return { ok: true, value: true };
  if (FALSE.has(text)) return { ok: true, value: false };
  return { ok: false, reason: "invalid" };
}

export type ParsedWeight =
  | { ok: true; grams: number; ambiguous: boolean }
  | { ok: false; reason: "empty" | "invalid" | "negative" };

/** Kilograms by default; a `g` / `gr` suffix means grams, `kg` is accepted. */
export function parseWeight(cell: unknown, format: NumberFormat): ParsedWeight {
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return { ok: false, reason: "invalid" };
    if (cell < 0) return { ok: false, reason: "negative" };
    return { ok: true, grams: Math.round(cell * 1000), ambiguous: false };
  }
  const text = String(cell ?? "")
    .trim()
    .toLowerCase();
  if (!text) return { ok: false, reason: "empty" };
  const m = /^(.*?)(kg|kilograma?|gr?|grama?)?\.?$/.exec(text.replace(SPACES, ""));
  const unit = m?.[2] ?? "kg";
  const n = parseNumber(m?.[1] ?? text, format);
  if (!n.ok) return n;
  if (n.value < 0) return { ok: false, reason: "negative" };
  const grams = unit.startsWith("k") ? n.value * 1000 : n.value;
  return { ok: true, grams: Math.round(grams), ambiguous: n.ambiguous };
}
