/**
 * Serbian title/description templates per page type (SEO-ADS §J1). Pure: every value comes
 * from real data passed in; the builder (`lib/seo/metadata.ts`) adds the brand suffix and the
 * length limits. Descriptions drop their least important part first instead of being cut in
 * the middle of an OEM number.
 */
import { formatRSD } from "@/lib/format/money";
import { pluralSr } from "@/lib/format/plural";
import { DESCRIPTION_MAX } from "@/lib/seo/metadata";

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

export function productMeta(p: {
  name: string;
  manufacturer: string;
  qualityLabel: string;
  code: string | null;
  fitmentSummary: string | null;
  pricePara: number | null;
  stockState: StockState;
}): MetaText {
  const title = `${p.name} ${p.manufacturer}${p.code ? ` ${p.code}` : ""}`;
  const head = `${p.name} (${p.manufacturer}, ${p.qualityLabel})`;
  const withVehicles = p.fitmentSummary ? `${head} za ${p.fitmentSummary}.` : `${head}.`;
  const price = p.pricePara !== null ? `Cena ${formatRSD(p.pricePara)} sa PDV-om.` : "";
  const code = p.code ? `Kat. br. ${p.code}.` : "";
  const tail = [price, stockSentence(p.stockState), code].filter(Boolean);
  let description = [withVehicles, ...tail].join(" ");
  if (description.length > DESCRIPTION_MAX && p.fitmentSummary) {
    // Shorten the vehicle list first — price, stock and the code matter more.
    const room = DESCRIPTION_MAX - [`${head} za`, "…", ...tail].join(" ").length - 2;
    const vehicles =
      room > 12 ? `${p.fitmentSummary.slice(0, room).replace(/[\s,;]+\S*$/, "")}…` : "";
    description = [vehicles ? `${head} za ${vehicles}.` : `${head}.`, ...tail].join(" ");
  }
  return { title, description };
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
