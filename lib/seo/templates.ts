/**
 * Serbian title/description templates per page type (SEO-ADS §J1). Pure: every value comes
 * from real data passed in; the builder (`lib/seo/metadata.ts`) adds the brand suffix and the
 * length limits. Descriptions drop their least important part first instead of being cut in
 * the middle of an OEM number.
 */
import { formatRSD } from "@/lib/format/money";
import { pluralSr } from "@/lib/format/plural";
import { clampText, defaultTitleSuffix, DESCRIPTION_MAX, TITLE_MAX } from "@/lib/seo/metadata";

export type MetaText = { title: string; description: string };

const ARTIKAL = ["artikal", "artikla", "artikala"] as const;

/** „VW“ is how Serbian buyers search for Volkswagen parts in titles. */
export function shortBrandName(name: string): string {
  return name === "Volkswagen" ? "VW" : name;
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

/**
 * Product title (≤ 60 with the suffix): „{Naziv} {Proizvođač} {OEM}“, shortened smartly —
 * the OEM number is what buyers type, so the brand suffix and then the manufacturer go
 * first, and only then the name is cut (never the code).
 */
export function productTitle(
  p: { name: string; manufacturer: string; code: string | null },
  suffix: string = defaultTitleSuffix(),
): string {
  const name = p.name.replace(/s+/g, " ").trim();
  const code = p.code?.trim() ?? "";
  const withCode = (base: string) => (code ? `${base} ${code}` : base);
  const candidates = [
    `${withCode(`${name} ${p.manufacturer}`)}${suffix}`,
    code ? `${withCode(name)}${suffix}` : null,
    withCode(`${name} ${p.manufacturer}`),
    code ? withCode(name) : null,
  ].filter((t): t is string => t !== null);
  const fits = candidates.find((t) => t.length <= TITLE_MAX);
  if (fits) return fits;
  const room = TITLE_MAX - (code ? code.length + 1 : 0);
  return withCode(clampText(name, Math.max(20, room)));
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
  const head = `${p.name} (${p.manufacturer}, ${p.qualityLabel})`;
  const price = p.pricePara !== null ? `Cena ${formatRSD(p.pricePara)} sa PDV-om.` : "";
  const code = p.code ? `Kat. br. ${p.code}.` : "";
  const tail = [price, stockSentence(p.stockState), code].filter(Boolean).join(" ");
  const full = p.fitmentSummary ? `${head} za ${p.fitmentSummary}. ${tail}` : `${head}. ${tail}`;
  if (full.length <= DESCRIPTION_MAX || !p.fitmentSummary) return { title, description: full };
  // Shorten the vehicle list first — price, stock and the code matter more.
  const room = DESCRIPTION_MAX - `${head} za … ${tail}`.length;
  const vehicles = room > 12 ? p.fitmentSummary.slice(0, room).replace(/[s,;]+S*$/, "") : "";
  return {
    title,
    description: vehicles ? `${head} za ${vehicles}… ${tail}` : `${head}. ${tail}`,
  };
}

export function categoryMeta(c: {
  name: string;
  productCount: number;
  inStockCount: number;
  minPricePara?: number | null;
  manufacturers?: string[];
  page?: number;
}): MetaText {
  const page = c.page && c.page > 1 ? ` — strana ${c.page}` : "";
  const count = `${c.productCount} ${pluralSr(c.productCount, ARTIKAL)}, ${c.inStockCount} na stanju`;
  const from = c.minPricePara ? ` od ${formatRSD(c.minPricePara)}` : "";
  return {
    title: `${c.name} za VW, Audi, Škoda, SEAT${page}`,
    description: fitSentences(
      [`${c.name} za VAG vozila: ${count}${from}.`],
      [
        c.manufacturers?.length ? `Proizvođači: ${c.manufacturers.slice(0, 4).join(", ")}.` : "",
        "Cene sa PDV-om, pouzeće ili preuzimanje u radnji.",
      ].filter(Boolean),
    ),
  };
}

export function systemMeta(s: { name: string; categories: string[] }): MetaText {
  return {
    title: `${s.name} — delovi za VAG vozila`,
    description: fitSentences(
      [`${s.name}: delovi za Volkswagen, Audi, Škoda, SEAT i Cupra.`],
      [
        s.categories.length ? `${s.categories.slice(0, 6).join(", ")}.` : "",
        "Cene sa PDV-om i stanje.",
      ].filter(Boolean),
    ),
  };
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
  const vehicle = l.modelName ? `${brand} ${l.modelName}` : l.brandName;
  const title = l.modelName
    ? `${l.categoryName} za ${vehicle}`
    : `${l.categoryName} za ${vehicle} — cene i stanje`;
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
    title,
    description: fitSentences(
      [`${l.categoryName} za ${vehicle}:`, ...facts],
      [
        l.generations?.length ? `Generacije: ${l.generations.slice(0, 4).join(", ")}.` : "",
        l.manufacturers?.length ? `Proizvođači: ${l.manufacturers.slice(0, 3).join(", ")}.` : "",
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
  const name = `${shortBrandName(g.brandName)} ${g.generationName}`;
  return {
    title: `Delovi za ${name} (${g.years})`,
    description: fitSentences(
      [
        `Delovi za ${name}: ${g.productCount} ${pluralSr(g.productCount, ARTIKAL)} u ${g.categories.length} ${pluralSr(g.categories.length, ["kategoriji", "kategorije", "kategorija"])}.`,
      ],
      [
        g.categories.length ? `${g.categories.slice(0, 4).join(", ")}.` : "",
        g.engines.length ? `Motori: ${g.engines.slice(0, 3).join(", ")}.` : "",
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
