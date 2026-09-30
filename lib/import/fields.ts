/**
 * Import target fields (docs/IMPORT.md §K2): the canonical Serbian template header, the
 * synonyms accepted in accounting-software exports, and which import modes use the field.
 * Pure — shared by the worker, the wizard, the template builder and Convex.
 */

export const IMPORT_FIELDS = [
  "sku",
  "name",
  "category",
  "manufacturer",
  "quality",
  "oem",
  "mpn",
  "cross",
  "priceRetail",
  "priceNet",
  "cost",
  "stock",
  "leadTimeDays",
  "fitment",
  "description",
  "images",
  "weight",
  "ean",
  "active",
  "lowStockThreshold",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** `ignore` = „Ne uvozi“ (the column stays unmapped). */
export type MappingTarget = ImportField | "ignore";

export type ImportMode = "full" | "stock_price";

export type FieldDef = {
  field: ImportField;
  /** Canonical header in the template and in product exports (round-trip). */
  header: string;
  /** Short label for the mapping UI. */
  label: string;
  /** Cell comment in the template. */
  help: string;
  synonyms: readonly string[];
  /** Used in „samo lager i cene“ mode. */
  stockPrice: boolean;
};

export const FIELD_DEFS: readonly FieldDef[] = [
  {
    field: "sku",
    header: "Šifra",
    label: "Šifra artikla",
    help: "Obavezno. Vaša interna šifra artikla (iz knjigovodstvenog programa). Po njoj se artikal pronalazi pri sledećem uvozu.",
    synonyms: [
      "šifra",
      "sifra",
      "šifra artikla",
      "šifra proizvoda",
      "sku",
      "artikal",
      "kod",
      "kod artikla",
      "id artikla",
      "interna šifra",
      "broj artikla",
    ],
    stockPrice: true,
  },
  {
    field: "name",
    header: "Naziv",
    label: "Naziv",
    help: "Obavezno za nove artikle. Do 160 znakova, npr. „Kočioni disk prednji 288 × 25 mm, ventilirani“.",
    synonyms: [
      "naziv",
      "naziv artikla",
      "naziv proizvoda",
      "ime",
      "opis kratki",
      "name",
      "product name",
    ],
    stockPrice: false,
  },
  {
    field: "category",
    header: "Kategorija",
    label: "Kategorija",
    help: "Obavezno za nove artikle. Naziv kategorije sa lista „Kategorije“ (velika i mala slova i kvačice nisu bitni).",
    synonyms: ["kategorija", "grupa", "grupa artikala", "podgrupa", "category"],
    stockPrice: false,
  },
  {
    field: "manufacturer",
    header: "Proizvođač",
    label: "Proizvođač",
    help: "Obavezno za nove artikle. Naziv sa lista „Proizvođači“; nepoznat proizvođač se napravi pri uvozu.",
    synonyms: [
      "proizvođač",
      "proizvodjac",
      "proizvodac",
      "brend",
      "brand",
      "marka dela",
      "manufacturer",
    ],
    stockPrice: false,
  },
  {
    field: "quality",
    header: "Kvalitet",
    label: "Kvalitet",
    help: "original, oem ili aftermarket. Prazno: podrazumevani kvalitet proizvođača.",
    synonyms: ["kvalitet", "tip", "vrsta", "quality"],
    stockPrice: false,
  },
  {
    field: "oem",
    header: "OEM brojevi",
    label: "OEM brojevi",
    help: "Originalni (VAG) brojevi, više brojeva odvojite sa ; ili novim redom. Razmaci i tačke unutar broja su dozvoljeni.",
    synonyms: [
      "oem",
      "oe",
      "oe broj",
      "oem broj",
      "oem brojevi",
      "kataloški broj",
      "kat. br.",
      "kat br",
      "originalni broj",
      "orig. broj",
      "vag broj",
      "broj dela",
    ],
    stockPrice: false,
  },
  {
    field: "mpn",
    header: "Broj proizvođača",
    label: "Broj proizvođača",
    help: "Kataloški broj proizvođača dela (npr. ATE 24.0125-0158.1).",
    synonyms: [
      "broj proizvođača",
      "šifra proizvođača",
      "kataloški broj proizvođača",
      "mpn",
      "ref",
      "referenca",
      "part number",
    ],
    stockPrice: false,
  },
  {
    field: "cross",
    header: "Zamenski brojevi",
    label: "Zamenski brojevi",
    help: "Brojevi drugih proizvođača za isti deo, u obliku „Proizvođač broj“, odvojeni sa ;.",
    synonyms: [
      "zamenski",
      "zamenski broj",
      "zamenski brojevi",
      "cross",
      "cross reference",
      "uporedni broj",
      "ekvivalent",
      "alternativa",
    ],
    stockPrice: false,
  },
  {
    field: "priceRetail",
    header: "MP cena (sa PDV)",
    label: "MP cena (sa PDV)",
    help: "Obavezno za nove artikle. Maloprodajna cena u dinarima sa PDV-om, npr. 12.990 ili 12.990,00.",
    synonyms: [
      "mp cena",
      "mpc",
      "maloprodajna cena",
      "cena sa pdv",
      "mp cena sa pdv",
      "cena",
      "cena rsd",
      "price",
      "retail price",
    ],
    stockPrice: true,
  },
  {
    field: "priceNet",
    header: "VP cena (bez PDV)",
    label: "VP cena (bez PDV)",
    help: "Koristi se samo ako nema MP cene: MP cena = VP cena × 1,2.",
    synonyms: [
      "vp cena",
      "vpc",
      "veleprodajna cena",
      "cena bez pdv",
      "vp cena bez pdv",
      "net price",
    ],
    stockPrice: true,
  },
  {
    field: "cost",
    header: "Nabavna cena (bez PDV)",
    label: "Nabavna cena",
    help: "Vidi je samo osoblje; služi za maržu.",
    synonyms: ["nabavna cena", "nabavna cena bez pdv", "nc", "nabavna", "cost", "purchase price"],
    stockPrice: true,
  },
  {
    field: "stock",
    header: "Količina",
    label: "Količina",
    help: "Stanje na lageru, ceo broj 0 ili veći. Prazno: stanje se ne menja (novi artikal: 0).",
    synonyms: [
      "količina",
      "kolicina",
      "stanje",
      "lager",
      "zaliha",
      "na stanju",
      "stock",
      "qty",
      "quantity",
      "kom",
    ],
    stockPrice: true,
  },
  {
    field: "leadTimeDays",
    header: "Rok isporuke (dana)",
    label: "Rok isporuke (dana)",
    help: "Za koliko dana nabavljate deo kada ga nema na stanju.",
    synonyms: ["rok isporuke", "rok isporuke dana", "isporuka dana", "lead time"],
    stockPrice: true,
  },
  {
    field: "fitment",
    header: "Primena (vozila)",
    label: "Primena (vozila)",
    help: "Vozila odvojena sa ;, npr. „VW Golf VII 2012-2020 [CRLB, CUNA]; Škoda Octavia III“. Nazive vozila vidite na listu „Vozila“.",
    synonyms: [
      "primena",
      "primena vozila",
      "vozilo",
      "vozila",
      "odgovara za",
      "model",
      "kompatibilnost",
      "fits",
      "applications",
    ],
    stockPrice: false,
  },
  {
    field: "description",
    header: "Opis",
    label: "Opis",
    help: "Opis za stranicu artikla, do 5.000 znakova.",
    synonyms: ["opis", "opis artikla", "description", "napomena"],
    stockPrice: false,
  },
  {
    field: "images",
    header: "Slike (URL)",
    label: "Slike (URL)",
    help: "Adrese slika (https://…), više adresa odvojite sa ;. Slike se preuzimaju posle uvoza, do 12 po artiklu.",
    synonyms: [
      "slika",
      "slike",
      "slika url",
      "slike url",
      "url slike",
      "image",
      "image url",
      "fotografija",
    ],
    stockPrice: false,
  },
  {
    field: "weight",
    header: "Težina (kg)",
    label: "Težina (kg)",
    help: "U kilogramima (npr. 5,4); dodajte „g“ za grame (npr. 450 g).",
    synonyms: ["težina", "tezina", "težina kg", "masa", "weight"],
    stockPrice: false,
  },
  {
    field: "ean",
    header: "EAN",
    label: "EAN (bar kod)",
    help: "8 do 14 cifara.",
    synonyms: ["ean", "barkod", "bar kod", "gtin"],
    stockPrice: false,
  },
  {
    field: "active",
    header: "Aktivan",
    label: "Aktivan",
    help: "da ili ne. Neaktivan artikal se ne vidi na sajtu. Prazno: novi artikal je aktivan, postojeći se ne menja.",
    synonyms: ["aktivan", "status", "active"],
    stockPrice: true,
  },
  {
    field: "lowStockThreshold",
    header: "Minimalna zaliha",
    label: "Minimalna zaliha",
    help: "Ispod ove količine artikal je „malo na stanju“. Prazno: podrazumevani prag iz podešavanja.",
    synonyms: ["minimalna zaliha", "min. količina", "min kolicina", "prag"],
    stockPrice: false,
  },
];

export const FIELD_BY_KEY: Readonly<Record<ImportField, FieldDef>> = Object.fromEntries(
  FIELD_DEFS.map((d) => [d.field, d]),
) as Record<ImportField, FieldDef>;

/** Template / export column order. */
export const TEMPLATE_FIELDS: readonly ImportField[] = [
  "sku",
  "name",
  "category",
  "manufacturer",
  "quality",
  "oem",
  "mpn",
  "cross",
  "priceRetail",
  "cost",
  "stock",
  "leadTimeDays",
  "fitment",
  "description",
  "images",
  "weight",
  "ean",
  "active",
  "lowStockThreshold",
];

export const MODE_LABEL: Readonly<Record<ImportMode, string>> = {
  full: "Pun uvoz (novi i postojeći artikli)",
  stock_price: "Samo lager i cene",
};

export function fieldsForMode(mode: ImportMode): readonly ImportField[] {
  return mode === "full"
    ? IMPORT_FIELDS
    : FIELD_DEFS.filter((d) => d.stockPrice).map((d) => d.field);
}

/** One column → one field. Mapping entries use 0-based column indexes of the sheet. */
export type ColumnMapping = { column: number; header: string; field: MappingTarget };

/** Field → column index for the mapped (non-ignored) columns. */
export function mappingIndex(
  mapping: readonly ColumnMapping[],
): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  for (const m of mapping)
    if (m.field !== "ignore" && out[m.field] === undefined) out[m.field] = m.column;
  return out;
}

/** Mapping problems that block the next step (missing key columns, duplicates). */
export function mappingProblems(mapping: readonly ColumnMapping[], mode: ImportMode): string[] {
  const problems: string[] = [];
  const counts = new Map<ImportField, number>();
  for (const m of mapping)
    if (m.field !== "ignore") counts.set(m.field, (counts.get(m.field) ?? 0) + 1);
  for (const [field, n] of counts) {
    if (n > 1) problems.push(`Polje „${FIELD_BY_KEY[field].label}“ je izabrano za ${n} kolone.`);
  }
  if (!counts.has("sku") && !(mode === "full" && counts.has("oem") && counts.has("manufacturer")))
    problems.push("Izaberite kolonu sa šifrom artikla.");
  if (mode === "stock_price") {
    if (
      !["stock", "priceRetail", "priceNet", "cost", "active", "leadTimeDays"].some((f) =>
        counts.has(f as ImportField),
      )
    )
      problems.push("Izaberite bar jednu kolonu sa količinom, cenom ili statusom.");
  }
  return problems;
}
