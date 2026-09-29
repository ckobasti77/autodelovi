/**
 * Search text folding and query classification (docs/ARCHITECTURE.md §E9). Pure.
 *
 * Convex full-text search lowercases but never folds diacritics, so both the stored
 * `searchText` and every query go through `foldForSearch` (č/ć → c, š → s, ž → z, đ → dj,
 * Serbian Cyrillic → Latin, other diacritics stripped, punctuation → space).
 */
import { normalizeCode } from "./codes";
import { slugifySr } from "./slug";

export const SEARCH_TEXT_MAX = 1_500;
export const SEARCH_QUERY_MAX = 200;

export function foldForSearch(input: string): string {
  return slugifySr(input.slice(0, 4_000), { maxLength: 4_000 }).replace(/-/g, " ");
}

export type QueryKind = "code" | "text" | "mixed";

/** A token looks like a part number when it has ≥ 4 normalised chars and a digit. */
export function looksLikeCode(token: string): boolean {
  const normalized = normalizeCode(token);
  return normalized.length >= 4 && /\d/.test(normalized) && /^[A-Z0-9]+$/.test(normalized);
}

export type ClassifiedQuery = {
  kind: QueryKind;
  /** Normalised code candidates: the whole query when it is one spaced code, else tokens. */
  codes: string[];
  /** Folded text part (tokens that are not codes). */
  text: string;
  /** Folded full query (for logs and the search index). */
  folded: string;
};

/**
 * Splits a query into code candidates and text. „1K0 615 301 AA“ is one code; „pločice
 * 1K0698151“ is mixed; „kočione pločice golf“ is text.
 */
export function classifyQuery(raw: string): ClassifiedQuery {
  const query = raw.slice(0, SEARCH_QUERY_MAX).trim();
  const folded = foldForSearch(query);
  const whole = normalizeCode(query);
  const tokens = query.split(/[\s,;]+/).filter(Boolean);
  if (/^[A-Za-z0-9\s.\-/\\_]+$/.test(query) && looksLikeCode(query) && whole.length <= 25) {
    // One token („1K0615301AA“, „DF6503“) or one spaced/dotted code („1K0 615 301 AA“,
    // „N 910 845 01“): word-like tokens longer than 3 letters („golf“, „hladnjak“) mean text.
    const spacedCode =
      tokens.length > 1 &&
      whole.length >= 6 &&
      tokens.every((t) => /\d/.test(t) || normalizeCode(t).length <= 3) &&
      !tokens.every((t) => normalizeCode(t).length >= 7 && looksLikeCode(t));
    if (tokens.length === 1 || spacedCode)
      return { kind: "code", codes: [whole], text: "", folded };
  }
  const codes: string[] = [];
  const words: string[] = [];
  for (const token of tokens) {
    if (looksLikeCode(token)) codes.push(normalizeCode(token));
    else words.push(token);
  }
  const text = foldForSearch(words.join(" "));
  const kind: QueryKind = codes.length === 0 ? "text" : text ? "mixed" : "code";
  return { kind, codes: [...new Set(codes)], text, folded };
}

/** Builds a product's `searchText`: raw + folded names, codes and vehicle labels, capped. */
export function buildSearchText(parts: readonly (string | undefined | null)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const variant of [part.toLowerCase(), foldForSearch(part)]) {
      const clean = variant.replace(/\s+/g, " ").trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
  }
  return out.join(" ").slice(0, SEARCH_TEXT_MAX);
}
