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

// Vehicle terms (D230) ------------------------------------------------------------------

export type VehicleTermRef = { slug: string; name: string; aliases: readonly string[] };

/** The vehicle tree as the query parser needs it (brands → models → generations). */
export type VehicleTermTree = readonly {
  brand: VehicleTermRef;
  models: readonly { model: VehicleTermRef; generations: readonly VehicleTermRef[] }[];
}[];

export type VehicleTermMatch = {
  brandSlug: string;
  modelSlug: string | null;
  generationSlug: string | null;
};

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

function numeralValue(token: string): number {
  if (/^\d{1,2}$/.test(token)) return Number(token);
  return ROMAN.indexOf(token);
}

function isNumeral(token: string): boolean {
  const n = numeralValue(token);
  return n > 0 && n < ROMAN.length;
}

/** „Golf VII“ → „golf vii“, „golf 7“, „golfvii“, „golf7“ (Arabic ↔ Roman, spaced and compact). */
function phraseVariants(text: string): string[][] {
  const tokens = foldForSearch(text).split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.every(isNumeral)) return [];
  let variants: string[][] = [[]];
  for (const token of tokens) {
    const alternatives = isNumeral(token)
      ? [String(numeralValue(token)), ROMAN[numeralValue(token)]]
      : [token];
    variants = variants.flatMap((v) => alternatives.map((a) => [...v, a])).slice(0, 8);
  }
  const out = new Map<string, string[]>();
  for (const v of variants) {
    out.set(v.join(" "), v);
    if (v.length > 1) out.set(v.join(""), [v.join("")]);
  }
  return [...out.values()];
}

type TermEntry = { tokens: string[]; level: 0 | 1 | 2; b: number; m: number; g: number };

/**
 * Finds the vehicle a query names („pločice golf 7“, „disk passat b6“, „vw golf vii“) against
 * the vehicle tree: names, slugs and aliases, with Arabic ↔ Roman generation numbers. Longest
 * phrase wins; a phrase shared by several generations („b6“) only counts when another term of
 * the query names the model or brand. Returns the most specific vehicle and the tokens that
 * remain for the part search. A lone number right after a model („golf 9“) is a generation
 * the catalog does not have: it is consumed so it never turns into a free-text term.
 */
export function parseVehicleTerms(
  tokens: readonly string[],
  tree: VehicleTermTree,
): { match: VehicleTermMatch | null; rest: string[] } {
  const byFirst = new Map<string, TermEntry[]>();
  const add = (texts: readonly string[], entry: Omit<TermEntry, "tokens">) => {
    for (const text of texts)
      for (const variant of phraseVariants(text)) {
        const list = byFirst.get(variant[0]) ?? [];
        list.push({ ...entry, tokens: variant });
        byFirst.set(variant[0], list);
      }
  };
  tree.forEach(({ brand, models }, b) => {
    add([brand.name, brand.slug, ...brand.aliases], { level: 0, b, m: -1, g: -1 });
    models.forEach(({ model, generations }, m) => {
      add([model.name, model.slug, ...model.aliases], { level: 1, b, m, g: -1 });
      generations.forEach((generation, g) =>
        add([generation.name, generation.slug, ...generation.aliases], { level: 2, b, m, g }),
      );
    });
  });

  // Greedy longest match; every candidate of the winning length is kept for disambiguation.
  const groups: { start: number; length: number; entries: TermEntry[] }[] = [];
  for (let i = 0; i < tokens.length;) {
    let best: TermEntry[] = [];
    for (const entry of byFirst.get(tokens[i]) ?? []) {
      const n = entry.tokens.length;
      if (n > tokens.length - i || !entry.tokens.every((t, k) => tokens[i + k] === t)) continue;
      const top = best[0];
      if (!top || n > top.tokens.length || (n === top.tokens.length && entry.level > top.level))
        best = [entry];
      else if (n === top.tokens.length && entry.level === top.level) best.push(entry);
    }
    if (best.length === 0) {
      i++;
      continue;
    }
    groups.push({ start: i, length: best[0].tokens.length, entries: best });
    i += best[0].tokens.length;
  }

  const unique = (entries: TermEntry[]) => {
    const keys = new Set(entries.map((e) => `${e.b}:${e.m}:${e.g}`));
    return keys.size === 1 ? entries[0] : null;
  };
  const context = groups.flatMap((g) => (unique(g.entries) ? [unique(g.entries)!] : []));
  const resolved = groups.map((group) => {
    const single = unique(group.entries);
    if (single) return single;
    const fitting = group.entries.filter((e) =>
      context.some((c) => c.b === e.b && (c.level === 0 || c.m === e.m)),
    );
    return unique(fitting);
  });

  const consumed = new Set<number>();
  groups.forEach((group, k) => {
    const entry = resolved[k];
    if (!entry) return;
    for (let i = group.start; i < group.start + group.length; i++) consumed.add(i);
    const next = group.start + group.length;
    if (entry.level === 1 && next < tokens.length && isNumeral(tokens[next])) consumed.add(next);
  });

  const pick =
    resolved.find((e) => e?.level === 2) ??
    resolved.find((e) => e?.level === 1) ??
    resolved.find((e) => e?.level === 0) ??
    null;
  const rest = tokens.filter((_, i) => !consumed.has(i));
  if (!pick) return { match: null, rest };
  const node = tree[pick.b];
  const model = pick.m >= 0 ? node.models[pick.m] : null;
  return {
    match: {
      brandSlug: node.brand.slug,
      modelSlug: model ? model.model.slug : null,
      generationSlug: model && pick.g >= 0 ? model.generations[pick.g].slug : null,
    },
    rest,
  };
}

/**
 * Inflection-tolerant word match for ranking and category chips: „pločica“ finds „pločice“,
 * „disk“ finds „diskovi“, „amortizera“ finds „amortizeri“ (folded text on both sides).
 */
export function termMatchesText(term: string, foldedText: string): boolean {
  const stem = term.length >= 5 ? term.slice(0, Math.max(4, term.length - 2)) : term;
  return foldedText.split(" ").some((word) => word.startsWith(stem));
}

const STOPWORDS = new Set(["za", "sa", "od", "do", "na", "ili", "bez", "i", "u"]);

/**
 * Part terms for the full-text index: the tokens left after the vehicle, without one-letter
 * noise („b“ from a pasted „<b>disk</b>“ would prefix-match half the catalog) and prepositions
 * („za“, „sa“) that would match every name and no category.
 */
export function partTerms(tokens: readonly string[]): string[] {
  const long = tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return long.length > 0 ? long : [...tokens];
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
