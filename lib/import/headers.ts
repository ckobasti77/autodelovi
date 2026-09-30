/**
 * Header handling for the import wizard (docs/IMPORT.md §K1–K2): normalisation, automatic
 * column mapping by synonyms, header-row detection and mapping presets. Pure.
 */
import { slugifySr } from "../domain/slug";
import { FIELD_DEFS, type ColumnMapping, type ImportField, type MappingTarget } from "./fields";

/** Lowercase, diacritics folded (đ → dj), punctuation and spaces removed. */
export function normalizeHeader(header: string): string {
  return slugifySr(String(header ?? ""), { maxLength: 200 }).replace(/-/g, "");
}

export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      best = Math.min(best, row[j]!);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length]!;
}

export type Confidence = "exact" | "alias" | "fuzzy" | "partial";

const CONFIDENCE_SCORE: Readonly<Record<Confidence, number>> = {
  exact: 4,
  alias: 3,
  fuzzy: 2,
  partial: 1,
};

type Lexicon = { field: ImportField; canonical: string; synonyms: string[] };

const LEXICON: readonly Lexicon[] = FIELD_DEFS.map((d) => ({
  field: d.field,
  canonical: normalizeHeader(d.header),
  synonyms: [...new Set(d.synonyms.map(normalizeHeader).filter(Boolean))],
}));

export type HeaderGuess = { field: ImportField; confidence: Confidence };

/** Best field for one header, or null. Exact → alias → Levenshtein ≤ 2 → longest contained synonym. */
export function guessField(header: string): HeaderGuess | null {
  const h = normalizeHeader(header);
  if (!h) return null;
  for (const l of LEXICON) if (l.canonical === h) return { field: l.field, confidence: "exact" };
  for (const l of LEXICON)
    if (l.synonyms.includes(h)) return { field: l.field, confidence: "alias" };
  if (h.length >= 5) {
    let best: { field: ImportField; d: number } | null = null;
    for (const l of LEXICON) {
      for (const s of l.synonyms) {
        if (s.length < 5) continue;
        const d = levenshtein(h, s, 2);
        if (d <= 2 && (!best || d < best.d)) best = { field: l.field, d };
      }
    }
    if (best) return { field: best.field, confidence: "fuzzy" };
  }
  let partial: { field: ImportField; len: number } | null = null;
  for (const l of LEXICON) {
    for (const s of l.synonyms) {
      if (s.length >= 4 && h.includes(s) && (!partial || s.length > partial.len))
        partial = { field: l.field, len: s.length };
    }
  }
  return partial ? { field: partial.field, confidence: "partial" } : null;
}

export type AutoMapped = ColumnMapping & { confidence: Confidence | null };

/**
 * Maps every column; each field is used at most once (the most confident column wins,
 * then the leftmost). Unmatched columns are „Ne uvozi“.
 */
export function autoMap(headers: readonly string[]): AutoMapped[] {
  const guesses = headers.map((h) => guessField(h));
  const winner = new Map<ImportField, number>();
  guesses.forEach((g, column) => {
    if (!g) return;
    const current = winner.get(g.field);
    if (
      current === undefined ||
      CONFIDENCE_SCORE[g.confidence] > CONFIDENCE_SCORE[guesses[current]!.confidence]
    )
      winner.set(g.field, column);
  });
  return headers.map((header, column) => {
    const g = guesses[column];
    const field: MappingTarget = g && winner.get(g.field) === column ? g.field : "ignore";
    return {
      column,
      header: String(header ?? ""),
      field,
      confidence: field === "ignore" ? null : g!.confidence,
    };
  });
}

/**
 * Header row = the first of the first 10 rows with ≥ 3 cells that look like known headers;
 * otherwise the row with the most such cells (≥ 2); otherwise the first row.
 */
export function detectHeaderRow(rows: readonly (readonly unknown[])[]): number {
  let bestRow = 0;
  let bestHits = 0;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const hits = (rows[r] ?? []).filter(
      (cell) =>
        typeof cell === "string" &&
        guessField(cell)?.confidence !== "partial" &&
        guessField(cell) !== null,
    ).length;
    if (hits >= 3) return r;
    if (hits > bestHits) {
      bestHits = hits;
      bestRow = r;
    }
  }
  return bestHits >= 2 ? bestRow : 0;
}

export type PresetMapping = { headerNormalized: string; field: string };

/** Share of the preset's headers present in the file (0–1). A preset is suggested at ≥ 0.8. */
export function presetScore(preset: readonly PresetMapping[], headers: readonly string[]): number {
  if (preset.length === 0) return 0;
  const present = new Set(headers.map(normalizeHeader));
  return preset.filter((p) => present.has(p.headerNormalized)).length / preset.length;
}

/** Applies a preset: matching headers take the preset's field, the rest keep the auto-mapping. */
export function applyPreset(
  preset: readonly PresetMapping[],
  headers: readonly string[],
): AutoMapped[] {
  const byHeader = new Map(preset.map((p) => [p.headerNormalized, p.field]));
  const base = autoMap(headers);
  const used = new Set<string>();
  const out = base.map((m) => {
    const presetField = byHeader.get(normalizeHeader(m.header));
    if (presetField && !used.has(presetField)) {
      used.add(presetField);
      return { ...m, field: presetField as MappingTarget, confidence: "exact" as Confidence };
    }
    return m;
  });
  // A field claimed by the preset is removed from other auto-mapped columns.
  return out.map((m) =>
    m.field !== "ignore" && used.has(m.field) && byHeader.get(normalizeHeader(m.header)) !== m.field
      ? { ...m, field: "ignore" as MappingTarget, confidence: null }
      : m,
  );
}

export function toPresetMapping(mapping: readonly ColumnMapping[]): PresetMapping[] {
  return mapping
    .filter((m) => m.field !== "ignore" && normalizeHeader(m.header))
    .map((m) => ({ headerNormalized: normalizeHeader(m.header), field: m.field }));
}
