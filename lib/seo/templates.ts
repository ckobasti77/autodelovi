/**
 * Serbian title/description templates per page type (SEO-ADS §J1). Pure: every value comes
 * from real data passed in; the builder (`lib/seo/metadata.ts`) adds the brand suffix and the
 * length limits. Descriptions drop their least important part first instead of being cut in
 * the middle of an OEM number or a vehicle name.
 */
import { formatRSD } from "@/lib/format/money";
import { pluralSr } from "@/lib/format/plural";
import { defaultTitleSuffix, DESCRIPTION_MAX, shortenWords, TITLE_MAX } from "@/lib/seo/metadata";

export type MetaText = {
  title: string;
  description: string;
  /** End of `title` that shortening must keep (vehicle, page number) — see `pageTitle`. */
  titleKeep?: string;
};

const ARTIKAL = ["artikal", "artikla", "artikala"] as const;

/** „VW“ is how Serbian buyers search for Volkswagen parts in titles. */
export function shortBrandName(name: string): string {
  return name === "Volkswagen" ? "VW" : name;
}

/**
 * A vehicle name as it follows „za“ (accusative, COPY-05): feminine names ending in -a
 * decline — „Škoda“ → „Škodu“, „Cupra“ → „Cupru“, „Octavia“ → „Octaviju“, „Ibiza“ →
 * „Ibizu“ — while VW, Audi, SEAT and masculine models (Golf, Leon, Superb) stay as they are.
 * Only capitalised words in mixed case decline, so codes and numerals (III, 5E, B8) never do.
 */
export function accusativeSr(phrase: string): string {
  return phrase.replace(
    /(^|[\s(])(\p{Lu}\p{Ll}+)a(?=$|[\s),.])/gu,
    (_, before: string, stem: string) => `${before}${stem}${stem.endsWith("i") ? "ju" : "u"}`,
  );
}

/** „A“, „A i B“, „A, B i C“. */
export function listSr(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
}

/**
 * A list cut to the first `shown` items: the rest becomes „i još N“ after a comma-joined
 * list („A, B i još 3“); a list that is shown whole ends with „i“ instead. `hidden` counts
 * items that exist but are not in `items`. A single remaining item that is known is named
 * rather than counted („A, B i C“, never „A, B i još 1“).
 */
export function listMoreSr(
  items: readonly string[],
  shown: number,
  { hidden = 0, nameLast = true }: { hidden?: number; nameLast?: boolean } = {},
): string {
  let visible = items.slice(0, Math.max(0, shown));
  if (nameLast && hidden === 0 && items.length === visible.length + 1) visible = [...items];
  const more = hidden + items.length - visible.length;
  if (more <= 0) return listSr(visible);
  if (visible.length === 0) return "";
  return `${visible.join(", ")} i još ${more}`;
}

/** Joins sentences, dropping optional ones (from the end of the list) until it fits. */
export function fitSentences(
  required: string[],
  optional: string[],
  max: number = DESCRIPTION_MAX,
): string {
  const parts = [...required, ...optional];
  while (parts.length > required.length && parts.join(" ").length > max) parts.pop();
  return parts.join(" ");
}

type StockState = "in_stock" | "low_stock" | "out_of_stock" | "on_order";

function stockSentence(state: StockState): string {
  switch (state) {
    case "in_stock":
    case "low_stock":
      return "Na stanju.";
    case "on_order":
      return "Po porudžbini.";
    default:
      return "Trenutno nije na stanju.";
  }
}

/** A shortened name only counts when it keeps at least this much of the product name. */
const MIN_SHORT_NAME = 16;

/**
 * Product title (≤ 60 with the suffix): „{Naziv} {Proizvođač} {OEM}“. Shortened in the order
 * of D193: the brand suffix goes first, then the name is shortened to whole words, and only
 * when even that does not fit the manufacturer goes — the manufacturer is what tells two
 * parts with the same OEM number apart (SEO-01), and the code is never cut.
 */
export function productTitle(
  p: { name: string; manufacturer: string; code: string | null },
  suffix: string = defaultTitleSuffix(),
): string {
  const name = p.name.replace(/\s+/g, " ").trim();
  const maker = p.manufacturer.replace(/\s+/g, " ").trim();
  const code = p.code?.replace(/\s+/g, " ").trim() ?? "";
  const tail = [maker, code].filter(Boolean).join(" ");
  const full = `${name} ${tail}`.trim();
  if (full.length + suffix.length <= TITLE_MAX) return `${full}${suffix}`;
  if (full.length <= TITLE_MAX) return full;
  const short = shortenWords(name, TITLE_MAX - tail.length - 1);
  if (short.length >= Math.min(MIN_SHORT_NAME, name.length)) return `${short} ${tail}`;
  if (code) {
    const withCode = `${name} ${code}`;
    if (withCode.length <= TITLE_MAX) return withCode;
    const room = TITLE_MAX - code.length - 1;
    return `${shortenWords(name, room) || name.slice(0, room)} ${code}`;
  }
  return shortenWords(full, TITLE_MAX) || full.slice(0, TITLE_MAX);
}

/**
 * The stored fitment summary („VW Golf VII, VW Passat B8 i još 10“, written by the product
 * writer) as its vehicle labels and the number of vehicles it does not name.
 */
export function parseFitmentSummary(summary: string): { items: string[]; hidden: number } {
  const match = /^(.*?)(?:\s+i\s+još\s+(\d+))?\s*$/.exec(summary.trim());
  const items = (match?.[1] ?? "")
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { items, hidden: Number(match?.[2] ?? 0) };
}

export function productMeta(p: {
  name: string;
  manufacturer: string;
  qualityLabel: string;
  code: string | null;
  fitmentSummary: string | null;
  pricePara: number | null;
  stockState: StockState;
  titleSuffix?: string;
}): MetaText {
  const title = productTitle(p, p.titleSuffix);
  // „(Original VAG, Original VAG)“ says the same thing twice: the label goes when it repeats
  // the manufacturer (SEO-07).
  const quality = p.qualityLabel.trim();
  const maker =
    quality && quality.toLowerCase() !== p.manufacturer.trim().toLowerCase()
      ? `${p.manufacturer}, ${quality}`
      : p.manufacturer;
  const head = `${p.name} (${maker})`;
  const price = p.pricePara !== null ? `Cena ${formatRSD(p.pricePara)} sa PDV-om.` : "";
  const code = p.code ? `Kat. br. ${p.code}.` : "";
  const tail = [price, stockSentence(p.stockState), code].filter(Boolean).join(" ");
  const plain = `${head}. ${tail}`;
  if (!p.fitmentSummary) return { title, description: plain };
  // Shorten the vehicle list first — price, stock and the code matter more — and only ever
  // by whole vehicles, with the rest counted („VW Golf VII i još 11“).
  const { items, hidden } = parseFitmentSummary(p.fitmentSummary);
  for (let shown = items.length; shown >= 1; shown -= 1) {
    const vehicles = accusativeSr(listMoreSr(items, shown, { hidden, nameLast: false }));
    const description = `${head} za ${vehicles}. ${tail}`;
    if (description.length <= DESCRIPTION_MAX) return { title, description };
  }
  return { title, description: plain };
}

/** The J1 vehicle part of a category title (a fixed list of the shop's brands). */
const CATEGORY_VEHICLES = " za VW, Audi, Škoda, SEAT";

export function pageSuffix(page?: number): string {
  return page && page > 1 ? ` — strana ${page}` : "";
}

export function categoryMeta(c: {
  name: string;
  productCount: number;
  inStockCount: number;
  minPricePara?: number | null;
  manufacturers?: string[];
  page?: number;
}): MetaText {
  const titleKeep = `${CATEGORY_VEHICLES}${pageSuffix(c.page)}`;
  const count = `${c.productCount} ${pluralSr(c.productCount, ARTIKAL)}, ${c.inStockCount} na stanju`;
  const from = c.minPricePara ? `, od ${formatRSD(c.minPricePara)}` : "";
  const makers = c.manufacturers ?? [];
  return {
    title: `${c.name}${titleKeep}`,
    titleKeep,
    description: fitSentences(
      [`${c.name} za VAG vozila: ${count}${from}.`],
      [
        makers.length ? `Proizvođači: ${listMoreSr(makers, 4)}.` : "",
        "Cene sa PDV-om, pouzeće ili preuzimanje u radnji.",
      ].filter(Boolean),
    ),
  };
}

export function systemMeta(s: {
  name: string;
  categories: { name: string; count: number }[];
}): MetaText {
  const withParts = s.categories.filter((c) => c.count > 0);
  const total = withParts.reduce((n, c) => n + c.count, 0);
  const lead = total
    ? `${s.name}: ${total} ${pluralSr(total, ARTIKAL)} za VAG vozila u ${withParts.length} ${pluralSr(withParts.length, ["kategoriji", "kategorije", "kategorija"])}.`
    : `${s.name}: delovi za VAG vozila.`;
  return {
    title: `${s.name} — delovi za VAG vozila`,
    description: fitSentences(
      [lead],
      [
        withParts.length
          ? `${listMoreSr(
              withParts.slice(0, 5).map((c) => `${c.name} (${c.count})`),
              5,
              { hidden: Math.max(0, withParts.length - 5) },
            )}.`
          : "",
        "Cene sa PDV-om i stanje.",
      ].filter(Boolean),
    ),
  };
}

/**
 * Intro of a system hub when the owner has not written one (SEO-04): what the system covers,
 * from the real counts — never a generic sentence.
 */
export function systemIntro(s: {
  name: string;
  categories: { name: string; count: number }[];
}): string {
  const withParts = s.categories.filter((c) => c.count > 0);
  if (withParts.length === 0) return "";
  const total = withParts.reduce((n, c) => n + c.count, 0);
  const biggest = [...withParts].sort((a, b) => b.count - a.count);
  const named = biggest.map((c) => `${c.name} (${c.count})`);
  return [
    `U grupi „${s.name}“ je ${total} ${pluralSr(total, ARTIKAL)} za VAG vozila u ${withParts.length} ${pluralSr(withParts.length, ["kategoriji", "kategorije", "kategorija"])}: ${listMoreSr(named, 5)}.`,
    "Na stranici svakog dela su OEM broj, proizvođač i vozila za koja odgovara.",
  ].join(" ");
}

export function landingMeta(l: {
  categoryName: string;
  brandName: string;
  modelName?: string | null;
  productCount?: number | null;
  inStockCount?: number | null;
  price?: { minPara: number; maxPara: number } | null;
  manufacturers?: string[];
  generations?: string[];
}): MetaText {
  const brand = shortBrandName(l.brandName);
  const vehicle = accusativeSr(l.modelName ? `${brand} ${l.modelName}` : l.brandName);
  // The vehicle is what makes a landing distinct: only the category name is ever shortened.
  const titleKeep = l.modelName ? ` za ${vehicle}` : ` za ${vehicle} — cene i stanje`;
  const facts: string[] = [];
  if (l.productCount) {
    const stock = l.inStockCount ? `, ${l.inStockCount} na stanju` : "";
    const price =
      l.price && l.price.maxPara > 0
        ? l.price.minPara === l.price.maxPara
          ? `, ${formatRSD(l.price.minPara)}`
          : `, ${formatRSD(l.price.minPara)} – ${formatRSD(l.price.maxPara)}`
        : "";
    facts.push(`${l.productCount} ${pluralSr(l.productCount, ARTIKAL)}${stock}${price}.`);
  }
  return {
    title: `${l.categoryName}${titleKeep}`,
    titleKeep,
    description: fitSentences(
      [`${l.categoryName} za ${vehicle}:`, ...facts],
      [
        l.generations?.length ? `Generacije: ${listMoreSr(l.generations, 4)}.` : "",
        l.manufacturers?.length ? `Proizvođači: ${listMoreSr(l.manufacturers, 3)}.` : "",
        "Pouzeće ili preuzimanje u radnji.",
      ].filter(Boolean),
    ),
  };
}

export function generationMeta(g: {
  brandName: string;
  generationName: string;
  years: string;
  productCount: number;
  categories: string[];
  engines: string[];
}): MetaText {
  const name = accusativeSr(`${shortBrandName(g.brandName)} ${g.generationName}`);
  return {
    title: `Delovi za ${name} (${g.years})`,
    description: fitSentences(
      [
        `Delovi za ${name}: ${g.productCount} ${pluralSr(g.productCount, ARTIKAL)} u ${g.categories.length} ${pluralSr(g.categories.length, ["kategoriji", "kategorije", "kategorija"])}.`,
      ],
      [
        g.categories.length ? `${listMoreSr(g.categories, 4)}.` : "",
        g.engines.length ? `Motori: ${listMoreSr(g.engines, 3)}.` : "",
      ].filter(Boolean),
    ),
  };
}

/** Curated searches are compared case- and space-insensitively („kocione plocice golf 7“). */
export function normalizeCuratedQuery(q: string): string {
  return q.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isCuratedSearch(q: string, curated: readonly string[]): boolean {
  const key = normalizeCuratedQuery(q);
  return key.length > 0 && curated.some((c) => normalizeCuratedQuery(c) === key);
}
