/**
 * Fitment text in spreadsheets (docs/IMPORT.md §K3): segments split on `;`, `|` or new
 * lines, each `Marka Model Generacija [godine] [motori]`, e.g.
 * `VW Golf VII 2012-2020 [CRLB, CUNA]`, `Škoda Octavia III`, `Audi A4 B8 2.0 TDI`.
 * Matched against the vehicle reference by names and aliases. The formatter writes the
 * same shape, so product exports import back unchanged. Pure.
 */
import { foldForSearch } from "../domain/search";

export type VehicleRef = {
  brands: readonly { id: string; name: string; aliases: readonly string[] }[];
  models: readonly { id: string; brandId: string; name: string; aliases: readonly string[] }[];
  generations: readonly {
    id: string;
    brandId: string;
    modelId: string;
    name: string;
    aliases: readonly string[];
    yearFrom: number;
    yearTo?: number;
  }[];
  engines: readonly { id: string; name: string; codes: readonly string[] }[];
  links: readonly { generationId: string; engineId: string }[];
};

export type FitmentRef = {
  brandId: string;
  modelId: string;
  generationId: string;
  engineId?: string;
  yearFrom?: number;
  yearTo?: number;
};

export type ParsedFitments = { fitments: FitmentRef[]; unmatched: string[] };

const SEGMENTS = /[;|\r\n]+/;
const YEARS =
  /\b((?:19|20)\d{2})\s*(?:[-–—/]|do)\s*((?:19|20)\d{2})?\b|\bod\s+((?:19|20)\d{2})\b|\b((?:19|20)\d{2})\b/i;
const BRACKETS = /\[([^\]]*)\]/g;

type Candidate = { text: string; generation: VehicleRef["generations"][number] };

/** Pre-computed lookup structures (build once per import, reuse for every row). */
export type VehicleIndex = {
  ref: VehicleRef;
  brandByToken: Map<string, string>;
  candidates: Candidate[];
  engineByCode: Map<string, string>;
  enginesByGeneration: Map<string, Set<string>>;
  engineFolded: Map<string, string>;
};

export function buildVehicleIndex(ref: VehicleRef): VehicleIndex {
  const brandByToken = new Map<string, string>();
  for (const b of ref.brands) {
    for (const a of [b.name, ...b.aliases]) brandByToken.set(foldForSearch(a), b.id);
  }
  const candidates: Candidate[] = [];
  for (const g of ref.generations) {
    const texts = new Set([g.name, ...g.aliases].map(foldForSearch).filter(Boolean));
    for (const text of texts) candidates.push({ text, generation: g });
  }
  // Longest first, so „a4 b6“ wins over the bare alias „b6“.
  candidates.sort((a, b) => b.text.length - a.text.length);
  const engineByCode = new Map<string, string>();
  const engineFolded = new Map<string, string>();
  for (const e of ref.engines) {
    for (const c of e.codes) engineByCode.set(c.toUpperCase(), e.id);
    engineFolded.set(e.id, foldForSearch(e.name));
  }
  const enginesByGeneration = new Map<string, Set<string>>();
  for (const l of ref.links) {
    const set = enginesByGeneration.get(l.generationId) ?? new Set<string>();
    set.add(l.engineId);
    enginesByGeneration.set(l.generationId, set);
  }
  return { ref, brandByToken, candidates, engineByCode, enginesByGeneration, engineFolded };
}

const containsWords = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `);

function removeWords(haystack: string, needle: string): string {
  return ` ${haystack} `.replace(` ${needle} `, " ").trim().replace(/\s+/g, " ");
}

function parseSegment(index: VehicleIndex, segment: string): FitmentRef[] | null {
  let text = segment;
  const codes: string[] = [];
  text = text.replace(BRACKETS, (_, inner: string) => {
    for (const c of inner.split(/[,\s/]+/)) if (c.trim()) codes.push(c.trim().toUpperCase());
    return " ";
  });
  let yearFrom: number | undefined;
  let yearTo: number | undefined;
  const y = YEARS.exec(text);
  if (y) {
    if (y[1]) {
      yearFrom = Number(y[1]);
      yearTo = y[2] ? Number(y[2]) : undefined;
    } else if (y[3]) yearFrom = Number(y[3]);
    else if (y[4]) {
      yearFrom = Number(y[4]);
      yearTo = Number(y[4]);
    }
    text = text.replace(y[0], " ");
  }
  let folded = foldForSearch(text);
  if (!folded) return null;

  const first = folded.split(" ")[0] ?? "";
  const brandId = index.brandByToken.get(first);
  if (brandId) folded = folded.split(" ").slice(1).join(" ");

  const matches = index.candidates.filter(
    (c) => (!brandId || c.generation.brandId === brandId) && containsWords(folded, c.text),
  );
  if (matches.length === 0) return null;
  const longest = matches[0]!.text.length;
  const top = matches.filter((m) => m.text.length === longest);
  const unique = [...new Map(top.map((m) => [m.generation.id, m])).values()];
  let chosen = unique;
  if (unique.length > 1 && yearFrom !== undefined) {
    chosen = unique.filter(
      (m) => yearFrom! >= m.generation.yearFrom - 1 && yearFrom! <= (m.generation.yearTo ?? 9999),
    );
  }
  if (chosen.length !== 1) return null;
  const { generation } = chosen[0]!;
  const rest = removeWords(folded, chosen[0]!.text);

  const linked = index.enginesByGeneration.get(generation.id);
  let engineIds: string[] = [];
  if (codes.length > 0) {
    for (const code of codes) {
      const id = index.engineByCode.get(code);
      if (!id || (linked && linked.size > 0 && !linked.has(id))) return null;
      if (!engineIds.includes(id)) engineIds.push(id);
    }
  } else if (rest) {
    const tokens = rest.split(" ").filter((t) => t !== "kw" && t !== "ks");
    const pool = linked ? [...linked] : [];
    engineIds = pool.filter((id) => {
      const name = index.engineFolded.get(id) ?? "";
      return tokens.every((t) => containsWords(name, t));
    });
    if (engineIds.length === 0) return null;
  }

  const years =
    yearFrom !== undefined &&
    (yearFrom > generation.yearFrom ||
      (yearTo !== undefined && yearTo < (generation.yearTo ?? 9999)))
      ? {
          yearFrom: Math.max(yearFrom, generation.yearFrom),
          ...(yearTo !== undefined ? { yearTo } : {}),
        }
      : {};
  const base = {
    brandId: generation.brandId,
    modelId: generation.modelId,
    generationId: generation.id,
    ...years,
  };
  return engineIds.length === 0 ? [base] : engineIds.map((engineId) => ({ ...base, engineId }));
}

/** Parses a whole fitment cell; unmatched segments are returned verbatim (row warning). */
export function parseFitmentText(index: VehicleIndex, cell: string): ParsedFitments {
  const fitments: FitmentRef[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const raw of cell.split(SEGMENTS)) {
    const segment = raw.trim();
    if (!segment) continue;
    const parsed = parseSegment(index, segment);
    if (!parsed) {
      unmatched.push(segment);
      continue;
    }
    for (const f of parsed) {
      const key = `${f.generationId}|${f.engineId ?? ""}|${f.yearFrom ?? ""}|${f.yearTo ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fitments.push(f);
    }
  }
  return { fitments, unmatched };
}

const BRAND_SHORT: Readonly<Record<string, string>> = { Volkswagen: "VW" };

/**
 * Writes fitments as text: one segment per generation and year range, engines listed by
 * their first code — `VW Golf VII [CRLB, CUAA]; Audi A4 B8 2010-2015`.
 */
export function formatFitments(ref: VehicleRef, fitments: readonly FitmentRef[]): string {
  const gens = new Map(ref.generations.map((g) => [g.id, g]));
  const brands = new Map(ref.brands.map((b) => [b.id, b]));
  const engines = new Map(ref.engines.map((e) => [e.id, e]));
  const groups = new Map<string, { label: string; codes: string[]; all: boolean }>();
  for (const f of fitments) {
    const g = gens.get(f.generationId);
    if (!g) continue;
    const brand = brands.get(g.brandId);
    const years = f.yearFrom !== undefined ? ` ${f.yearFrom}-${f.yearTo ?? ""}` : "";
    const label =
      `${brand ? (BRAND_SHORT[brand.name] ?? brand.name) : ""} ${g.name}${years}`.trim();
    const key = `${g.id}|${f.yearFrom ?? ""}|${f.yearTo ?? ""}`;
    const group = groups.get(key) ?? { label, codes: [], all: false };
    const code = f.engineId ? engines.get(f.engineId)?.codes[0] : undefined;
    if (!f.engineId) group.all = true;
    else if (code && !group.codes.includes(code)) group.codes.push(code);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => (g.all || g.codes.length === 0 ? g.label : `${g.label} [${g.codes.join(", ")}]`))
    .join("; ");
}
