/**
 * Part taxonomy — the single code source of truth for systems, categories, 3D instances and
 * explode stages (docs/3D-CONTRACT.md §F1, slugs frozen by D7). Used by the Convex seed, the
 * 3D manifest validator and the UI. Pure data — shared by Next and Convex.
 */

export type SystemSlug =
  | "motor-i-usis"
  | "izduvni-sistem"
  | "hladjenje-i-klima"
  | "transmisija"
  | "vesanje-i-upravljanje"
  | "kocnice"
  | "elektrika-i-svetla"
  | "karoserija"
  | "tockovi"
  | "servis";

export type TaxonomySystem = {
  slug: SystemSlug;
  labelSr: string;
  order: number;
};

export type TaxonomyInstance = {
  /** Node suffix: `part__<category>__<instance>`. */
  instance: string;
  /** Explode stage for this node when it differs from the category stage (senzori). */
  stage?: number;
};

export type TaxonomyCategory = {
  slug: string;
  labelSr: string;
  system: SystemSlug;
  /** Clickable 3D instances; empty for service categories without a mesh. */
  instances: TaxonomyInstance[];
  /** Explode stage (§F6); `null` for categories without a mesh. */
  stage: number | null;
  /** Up to 6 related category slugs (part panel „Povezano“, category page links). */
  relatedSlugs: string[];
};

export type TaxonomySubcategory = {
  slug: string;
  labelSr: string;
  parent: string;
  system: SystemSlug;
  relatedSlugs: string[];
};

export type TaxonomyStage = {
  stage: number;
  key: string;
  labelSr: string;
  scroll: { desktop: [number, number]; mobile: [number, number] };
};

export const SYSTEMS: readonly TaxonomySystem[] = [
  { slug: "motor-i-usis", labelSr: "Motor i usis", order: 1 },
  { slug: "izduvni-sistem", labelSr: "Izduvni sistem", order: 2 },
  { slug: "hladjenje-i-klima", labelSr: "Hlađenje i klima", order: 3 },
  { slug: "transmisija", labelSr: "Transmisija", order: 4 },
  { slug: "vesanje-i-upravljanje", labelSr: "Vešanje i upravljanje", order: 5 },
  { slug: "kocnice", labelSr: "Kočnice", order: 6 },
  { slug: "elektrika-i-svetla", labelSr: "Elektrika i svetla", order: 7 },
  { slug: "karoserija", labelSr: "Karoserija", order: 8 },
  { slug: "tockovi", labelSr: "Točkovi", order: 9 },
  { slug: "servis", labelSr: "Servis i održavanje", order: 10 },
];

const one = (...names: string[]): TaxonomyInstance[] => names.map((instance) => ({ instance }));
const CORNERS = one("fl", "fr", "rl", "rr");

export const CATEGORIES: readonly TaxonomyCategory[] = [
  // Motor i usis
  {
    slug: "motor",
    labelSr: "Blok motora i glava",
    system: "motor-i-usis",
    instances: one("block", "head"),
    stage: 5,
    relatedSlugs: [
      "karter-dihtunzi",
      "zupcasti-kais-vodena-pumpa",
      "nosaci-motora",
      "paljenje-grejaci",
    ],
  },
  {
    slug: "turbina",
    labelSr: "Turbina (turbopunjač)",
    system: "motor-i-usis",
    instances: one("main"),
    stage: 5,
    relatedSlugs: ["interkuler", "usisna-grana", "egr-ventil", "filter-vazduha"],
  },
  {
    slug: "interkuler",
    labelSr: "Interkuler",
    system: "motor-i-usis",
    instances: one("main", "pipes"),
    stage: 4,
    relatedSlugs: ["turbina", "usisna-grana", "hladnjak-ventilator"],
  },
  {
    slug: "usisna-grana",
    labelSr: "Usisna grana i kućište filtera",
    system: "motor-i-usis",
    instances: one("manifold", "airbox"),
    stage: 4,
    relatedSlugs: ["filter-vazduha", "turbina", "egr-ventil", "interkuler"],
  },
  {
    slug: "brizgaljke-pumpa-goriva",
    labelSr: "Brizgaljke i pumpa goriva",
    system: "motor-i-usis",
    instances: one("injectors", "pump"),
    stage: 5,
    relatedSlugs: ["filter-goriva", "paljenje-grejaci", "usisna-grana"],
  },
  {
    slug: "zupcasti-kais-vodena-pumpa",
    labelSr: "Set zupčastog kaiša i vodena pumpa",
    system: "motor-i-usis",
    instances: one("belt", "water-pump"),
    stage: 5,
    relatedSlugs: ["kais-alternatora", "termostat-creva", "motor"],
  },
  {
    slug: "kais-alternatora",
    labelSr: "Kaiš alternatora i zatezači",
    system: "motor-i-usis",
    instances: one("belt"),
    stage: 4,
    relatedSlugs: ["alternator", "zupcasti-kais-vodena-pumpa", "klima"],
  },
  {
    slug: "alternator",
    labelSr: "Alternator",
    system: "motor-i-usis",
    instances: one("main"),
    stage: 4,
    relatedSlugs: ["kais-alternatora", "akumulator", "anlaser"],
  },
  {
    slug: "anlaser",
    labelSr: "Anlaser",
    system: "motor-i-usis",
    instances: one("main"),
    stage: 4,
    relatedSlugs: ["akumulator", "alternator"],
  },
  {
    slug: "paljenje-grejaci",
    labelSr: "Svećice, bobine i grejači",
    system: "motor-i-usis",
    instances: one("coils"),
    stage: 5,
    relatedSlugs: ["brizgaljke-pumpa-goriva", "motor", "senzori"],
  },
  {
    slug: "karter-dihtunzi",
    labelSr: "Karter, pumpa ulja i dihtunzi",
    system: "motor-i-usis",
    instances: one("sump"),
    stage: 5,
    relatedSlugs: ["filter-ulja", "ulja-tecnosti", "motor"],
  },
  {
    slug: "egr-ventil",
    labelSr: "EGR ventil",
    system: "motor-i-usis",
    instances: one("main"),
    stage: 5,
    relatedSlugs: ["usisna-grana", "dpf-katalizator", "turbina"],
  },
  {
    slug: "nosaci-motora",
    labelSr: "Nosači motora i menjača",
    system: "motor-i-usis",
    instances: one("l", "r", "rear"),
    stage: 4,
    relatedSlugs: ["motor", "menjac"],
  },
  // Izduvni sistem
  {
    slug: "dpf-katalizator",
    labelSr: "DPF i katalizator",
    system: "izduvni-sistem",
    instances: one("main"),
    stage: 7,
    relatedSlugs: ["auspuh", "senzori", "egr-ventil"],
  },
  {
    slug: "auspuh",
    labelSr: "Auspuh (lonci i cevi)",
    system: "izduvni-sistem",
    instances: one("mid", "rear"),
    stage: 7,
    relatedSlugs: ["dpf-katalizator", "senzori"],
  },
  // Hlađenje i klima
  {
    slug: "hladnjak-ventilator",
    labelSr: "Hladnjak i ventilator",
    system: "hladjenje-i-klima",
    instances: one("radiator", "fan"),
    stage: 4,
    relatedSlugs: ["termostat-creva", "interkuler", "klima", "ulja-tecnosti"],
  },
  {
    slug: "termostat-creva",
    labelSr: "Termostat i creva hlađenja",
    system: "hladjenje-i-klima",
    instances: one("thermostat", "hoses"),
    stage: 4,
    relatedSlugs: ["hladnjak-ventilator", "zupcasti-kais-vodena-pumpa", "ulja-tecnosti"],
  },
  {
    slug: "klima",
    labelSr: "Kompresor i kondenzator klime",
    system: "hladjenje-i-klima",
    instances: one("compressor", "condenser"),
    stage: 4,
    relatedSlugs: ["hladnjak-ventilator", "filter-kabine", "kais-alternatora"],
  },
  // Transmisija
  {
    slug: "kvacilo-zamajac",
    labelSr: "Kvačilo i zamajac",
    system: "transmisija",
    instances: one("main"),
    stage: 6,
    relatedSlugs: ["menjac", "poluosovine", "nosaci-motora"],
  },
  {
    slug: "menjac",
    labelSr: "Menjač (DSG)",
    system: "transmisija",
    instances: one("main"),
    stage: 6,
    relatedSlugs: ["kvacilo-zamajac", "poluosovine", "ulja-tecnosti"],
  },
  {
    slug: "poluosovine",
    labelSr: "Poluosovine i homokinetički zglobovi",
    system: "transmisija",
    instances: one("l", "r"),
    stage: 6,
    relatedSlugs: ["lezaj-glavcina", "menjac", "ramena-selen-blokovi"],
  },
  // Vešanje i upravljanje
  {
    slug: "amortizeri-opruge",
    labelSr: "Amortizeri i opruge",
    system: "vesanje-i-upravljanje",
    instances: CORNERS,
    stage: 3,
    relatedSlugs: ["ramena-selen-blokovi", "spone-stabilizatori", "lezaj-glavcina"],
  },
  {
    slug: "ramena-selen-blokovi",
    labelSr: "Ramena i selen blokovi",
    system: "vesanje-i-upravljanje",
    instances: one("fl", "fr", "rear-axle"),
    stage: 3,
    relatedSlugs: ["amortizeri-opruge", "spone-stabilizatori", "lezaj-glavcina"],
  },
  {
    slug: "spone-stabilizatori",
    labelSr: "Spone i stabilizatori",
    system: "vesanje-i-upravljanje",
    instances: one("tie-rod-l", "tie-rod-r", "stabilizer"),
    stage: 3,
    relatedSlugs: ["letva-volana", "ramena-selen-blokovi", "amortizeri-opruge"],
  },
  {
    slug: "letva-volana",
    labelSr: "Letva volana",
    system: "vesanje-i-upravljanje",
    instances: one("main"),
    stage: 3,
    relatedSlugs: ["spone-stabilizatori", "ramena-selen-blokovi"],
  },
  {
    slug: "lezaj-glavcina",
    labelSr: "Ležaj točka i glavčina",
    system: "vesanje-i-upravljanje",
    instances: CORNERS,
    stage: 3,
    relatedSlugs: ["abs-senzori", "kocioni-diskovi", "poluosovine"],
  },
  // Kočnice
  {
    slug: "kocioni-diskovi",
    labelSr: "Kočioni diskovi",
    system: "kocnice",
    instances: CORNERS,
    stage: 3,
    relatedSlugs: ["kocione-plocice", "kocione-celjusti", "abs-senzori", "lezaj-glavcina"],
  },
  {
    slug: "kocione-plocice",
    labelSr: "Kočione pločice",
    system: "kocnice",
    instances: CORNERS,
    stage: 3,
    relatedSlugs: ["kocioni-diskovi", "kocione-celjusti", "abs-senzori", "ulja-tecnosti"],
  },
  {
    slug: "kocione-celjusti",
    labelSr: "Kočione čeljusti",
    system: "kocnice",
    instances: CORNERS,
    stage: 3,
    relatedSlugs: ["kocione-plocice", "kocioni-diskovi", "ulja-tecnosti"],
  },
  {
    slug: "abs-senzori",
    labelSr: "ABS senzori",
    system: "kocnice",
    instances: CORNERS,
    stage: 3,
    relatedSlugs: ["lezaj-glavcina", "kocioni-diskovi", "senzori"],
  },
  // Elektrika i svetla
  {
    slug: "akumulator",
    labelSr: "Akumulator",
    system: "elektrika-i-svetla",
    instances: one("main"),
    stage: 4,
    relatedSlugs: ["alternator", "anlaser"],
  },
  {
    slug: "farovi",
    labelSr: "Farovi",
    system: "elektrika-i-svetla",
    instances: one("l", "r"),
    stage: 1,
    relatedSlugs: ["stop-svetla", "branici", "hauba"],
  },
  {
    slug: "stop-svetla",
    labelSr: "Stop svetla",
    system: "elektrika-i-svetla",
    instances: one("l", "r"),
    stage: 1,
    relatedSlugs: ["farovi", "branici"],
  },
  {
    slug: "senzori",
    labelSr: "Senzori (lambda, parking, temperatura)",
    system: "elektrika-i-svetla",
    instances: [
      { instance: "lambda", stage: 7 },
      { instance: "park-front", stage: 1 },
      { instance: "coolant-temp", stage: 5 },
    ],
    stage: 5,
    relatedSlugs: ["abs-senzori", "dpf-katalizator", "termostat-creva"],
  },
  // Karoserija
  {
    slug: "hauba",
    labelSr: "Hauba",
    system: "karoserija",
    instances: one("main"),
    stage: 1,
    relatedSlugs: ["branici", "blatobrani", "farovi"],
  },
  {
    slug: "branici",
    labelSr: "Branici",
    system: "karoserija",
    instances: one("front", "rear"),
    stage: 1,
    relatedSlugs: ["farovi", "stop-svetla", "blatobrani", "senzori"],
  },
  {
    slug: "blatobrani",
    labelSr: "Blatobrani",
    system: "karoserija",
    instances: one("l", "r"),
    stage: 1,
    relatedSlugs: ["branici", "hauba", "vrata"],
  },
  {
    slug: "vrata",
    labelSr: "Vrata",
    system: "karoserija",
    instances: CORNERS,
    stage: 1,
    relatedSlugs: ["retrovizori", "stakla", "blatobrani"],
  },
  {
    slug: "retrovizori",
    labelSr: "Retrovizori",
    system: "karoserija",
    instances: one("l", "r"),
    stage: 1,
    relatedSlugs: ["vrata", "stakla"],
  },
  {
    slug: "stakla",
    labelSr: "Stakla",
    system: "karoserija",
    instances: one("windshield", "rear", "side"),
    stage: 1,
    relatedSlugs: ["brisaci", "vrata", "retrovizori"],
  },
  {
    slug: "brisaci",
    labelSr: "Brisači",
    system: "karoserija",
    instances: one("main"),
    stage: 1,
    relatedSlugs: ["stakla", "ulja-tecnosti"],
  },
  // Točkovi
  {
    slug: "felne-gume",
    labelSr: "Felne i gume",
    system: "tockovi",
    instances: CORNERS,
    stage: 2,
    relatedSlugs: ["lezaj-glavcina", "kocioni-diskovi"],
  },
  // Servis (no mesh)
  {
    slug: "filteri",
    labelSr: "Filteri",
    system: "servis",
    instances: [],
    stage: null,
    relatedSlugs: ["ulja-tecnosti", "karter-dihtunzi", "usisna-grana", "klima"],
  },
  {
    slug: "ulja-tecnosti",
    labelSr: "Ulja i tečnosti",
    system: "servis",
    instances: [],
    stage: null,
    relatedSlugs: ["filteri", "karter-dihtunzi", "menjac"],
  },
];

export const SUBCATEGORIES: readonly TaxonomySubcategory[] = [
  {
    slug: "filter-ulja",
    labelSr: "Filter ulja",
    parent: "filteri",
    system: "servis",
    relatedSlugs: ["ulja-tecnosti", "karter-dihtunzi", "filter-vazduha"],
  },
  {
    slug: "filter-vazduha",
    labelSr: "Filter vazduha",
    parent: "filteri",
    system: "servis",
    relatedSlugs: ["usisna-grana", "filter-ulja", "filter-kabine"],
  },
  {
    slug: "filter-goriva",
    labelSr: "Filter goriva",
    parent: "filteri",
    system: "servis",
    relatedSlugs: ["brizgaljke-pumpa-goriva", "filter-ulja"],
  },
  {
    slug: "filter-kabine",
    labelSr: "Filter kabine",
    parent: "filteri",
    system: "servis",
    relatedSlugs: ["klima", "filter-vazduha"],
  },
];

export const STAGES: readonly TaxonomyStage[] = [
  {
    stage: 0,
    key: "sklopljeno",
    labelSr: "Sklopljen automobil",
    scroll: { desktop: [0, 0.08], mobile: [0, 0.1] },
  },
  {
    stage: 1,
    key: "karoserija",
    labelSr: "Karoserija, stakla i svetla",
    scroll: { desktop: [0.08, 0.24], mobile: [0.1, 0.32] },
  },
  {
    stage: 2,
    key: "tockovi",
    labelSr: "Točkovi",
    scroll: { desktop: [0.18, 0.32], mobile: [0.1, 0.32] },
  },
  {
    stage: 3,
    key: "kocnice-vesanje",
    labelSr: "Kočnice, vešanje, upravljanje",
    scroll: { desktop: [0.28, 0.46], mobile: [0.3, 0.52] },
  },
  {
    stage: 4,
    key: "agregati",
    labelSr: "Pomoćni agregati, hlađenje, usis",
    scroll: { desktop: [0.42, 0.58], mobile: [0.5, 0.74] },
  },
  {
    stage: 5,
    key: "motor",
    labelSr: "Motor, turbina, gorivo, paljenje",
    scroll: { desktop: [0.54, 0.72], mobile: [0.5, 0.74] },
  },
  {
    stage: 6,
    key: "transmisija",
    labelSr: "Menjač, kvačilo, poluosovine",
    scroll: { desktop: [0.68, 0.84], mobile: [0.72, 0.92] },
  },
  {
    stage: 7,
    key: "izduvni",
    labelSr: "Izduvni sistem",
    scroll: { desktop: [0.8, 0.92], mobile: [0.72, 0.92] },
  },
];

/** `part__<category>__<instance>` for every clickable node. */
export function partNodeName(category: string, instance: string): string {
  return `part__${category}__${instance}`;
}

/** Every clickable node name in taxonomy order. */
export function allPartNodes(): string[] {
  return CATEGORIES.flatMap((c) => c.instances.map((i) => partNodeName(c.slug, i.instance)));
}

/** Every category or subcategory slug (the `/delovi/[slug]` namespace). */
export function allCategorySlugs(): string[] {
  return [...CATEGORIES.map((c) => c.slug), ...SUBCATEGORIES.map((s) => s.slug)];
}

/** Leaf categories are the ones products attach to (no children). */
export function isLeafCategory(slug: string): boolean {
  return !SUBCATEGORIES.some((s) => s.parent === slug);
}

const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));
const SUBCATEGORY_BY_SLUG = new Map(SUBCATEGORIES.map((s) => [s.slug, s]));
const SYSTEM_BY_SLUG = new Map(SYSTEMS.map((s) => [s.slug, s]));

export function findCategory(slug: string): TaxonomyCategory | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

export function findSubcategory(slug: string): TaxonomySubcategory | undefined {
  return SUBCATEGORY_BY_SLUG.get(slug);
}

export function findSystem(slug: string): TaxonomySystem | undefined {
  return SYSTEM_BY_SLUG.get(slug as SystemSlug);
}
