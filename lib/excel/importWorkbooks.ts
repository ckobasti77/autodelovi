/**
 * Import-side workbooks (docs/IMPORT.md §K5): the template (Proizvodi + Uputstvo +
 * Kategorije + Proizvođači + Vozila), the error report, and the product export that uses
 * the template's headers so it imports back unchanged. Built with SheetJS CE from the CDN
 * tarball (ARCHITECTURE §0.2). Pure: data in, bytes out.
 */
import * as XLSX from "xlsx";

import { FIELD_BY_KEY, TEMPLATE_FIELDS, type ImportField } from "../import/fields";
import { formatFitments, type FitmentRef, type VehicleRef } from "../import/fitmentText";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export { XLSX_TYPE };

const WIDTH: Partial<Record<ImportField, number>> = {
  sku: 16,
  name: 44,
  category: 26,
  manufacturer: 18,
  quality: 12,
  oem: 28,
  mpn: 20,
  cross: 30,
  priceRetail: 16,
  cost: 16,
  stock: 10,
  leadTimeDays: 12,
  fitment: 44,
  description: 50,
  images: 40,
  weight: 11,
  ean: 16,
  active: 9,
  lowStockThreshold: 12,
};

function write(book: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(book, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  }) as ArrayBuffer;
  return new Uint8Array(out);
}

function headerSheet(rows: (string | number | null)[][], withComments: boolean): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_FIELDS.map((f) => FIELD_BY_KEY[f].header),
    ...rows,
  ]);
  sheet["!cols"] = TEMPLATE_FIELDS.map((f) => ({ wch: WIDTH[f] ?? 14 }));
  if (withComments) {
    TEMPLATE_FIELDS.forEach((field, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })] as XLSX.CellObject;
      const comment = [{ a: "SKLOP", t: FIELD_BY_KEY[field].help }] as XLSX.Comments;
      comment.hidden = true;
      cell.c = comment;
    });
  }
  const lastCol = XLSX.utils.encode_col(TEMPLATE_FIELDS.length - 1);
  sheet["!autofilter"] = { ref: `A1:${lastCol}${Math.max(1, rows.length + 1)}` };
  return sheet;
}

export type TemplateReference = {
  categories: readonly { name: string; parentName?: string }[];
  manufacturers: readonly { name: string }[];
  vehicles: VehicleRef;
};

const GUIDE: string[][] = [
  ["Uputstvo za uvoz artikala"],
  [],
  [
    "1.",
    "Popunite list „Proizvodi“. Jedan red je jedan artikal; prvi red su nazivi kolona — ne menjajte ih.",
  ],
  [
    "2.",
    "Obavezno za nove artikle: Šifra, Naziv, Kategorija, Proizvođač i MP cena. Za postojeće je dovoljna Šifra i kolone koje menjate.",
  ],
  ["3.", "Prazna ćelija ne briše postojeću vrednost — uvoz menja samo ono što je upisano."],
  ["4.", "Cene pišite u dinarima sa PDV-om, npr. 12.990 ili 12.990,00. Količina je ceo broj."],
  [
    "5.",
    "Više OEM ili zamenskih brojeva odvojite tačkom-zarezom (;) ili novim redom u ćeliji. Razmaci i tačke unutar broja su dozvoljeni.",
  ],
  [
    "6.",
    "Kategoriju i proizvođača upišite tačno kao na listovima „Kategorije“ i „Proizvođači“ (velika slova i kvačice nisu bitni).",
  ],
  [
    "7.",
    "Primena: vozila odvojena sa ;, npr. „VW Golf VII 2012-2020 [CRLB, DFGA]; Škoda Octavia III“. Nazive vidite na listu „Vozila“.",
  ],
  [
    "8.",
    "Slike: adrese koje počinju sa https://, odvojene sa ;. Slike se preuzimaju posle uvoza, samo za artikle koji još nemaju slike.",
  ],
  ["9.", "Aktivan: da ili ne. Neaktivan artikal ostaje u katalogu, ali se ne vidi na sajtu."],
  [],
  [
    "Pre upisa uvoz uvek prikaže probni rezultat: šta će biti novo, šta se menja i koji redovi imaju grešku. Svaki uvoz se može poništiti.",
  ],
];

export function buildTemplateWorkbook(ref: TemplateReference): Uint8Array {
  const book = XLSX.utils.book_new();
  book.Props = { Title: "Šablon za uvoz artikala", Author: "SKLOP" };
  const products = headerSheet([], true);
  products["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(book, products, "Proizvodi");

  const guide = XLSX.utils.aoa_to_sheet(GUIDE);
  guide["!cols"] = [{ wch: 4 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(book, guide, "Uputstvo");

  const repeated = new Map<string, number>();
  for (const c of ref.categories)
    repeated.set(c.name.toLowerCase(), (repeated.get(c.name.toLowerCase()) ?? 0) + 1);
  const categories = XLSX.utils.aoa_to_sheet([
    ["Grupa", "Kategorija", "Upišite u kolonu „Kategorija“"],
    ...[...ref.categories]
      .sort(
        (a, b) =>
          (a.parentName ?? "").localeCompare(b.parentName ?? "", "sr") ||
          a.name.localeCompare(b.name, "sr"),
      )
      .map((c) => [
        c.parentName ?? "",
        c.name,
        (repeated.get(c.name.toLowerCase()) ?? 0) > 1 && c.parentName
          ? `${c.parentName} › ${c.name}`
          : c.name,
      ]),
  ]);
  categories["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(book, categories, "Kategorije");

  const makers = XLSX.utils.aoa_to_sheet([
    ["Proizvođač"],
    ...[...ref.manufacturers]
      .sort((a, b) => a.name.localeCompare(b.name, "sr"))
      .map((m) => [m.name]),
  ]);
  makers["!cols"] = [{ wch: 30 }];
  XLSX.utils.book_append_sheet(book, makers, "Proizvođači");

  const brands = new Map(ref.vehicles.brands.map((b) => [b.id, b.name]));
  const models = new Map(ref.vehicles.models.map((m) => [m.id, m.name]));
  const engines = new Map(ref.vehicles.engines.map((e) => [e.id, e]));
  const linked = new Map<string, string[]>();
  for (const l of ref.vehicles.links) {
    const e = engines.get(l.engineId);
    if (!e?.codes[0]) continue;
    linked.set(l.generationId, [
      ...(linked.get(l.generationId) ?? []),
      `${e.codes[0]} (${e.name})`,
    ]);
  }
  const vehicles = XLSX.utils.aoa_to_sheet([
    [
      "Marka",
      "Model",
      "Generacija",
      "Godine",
      "Motori (kod — naziv)",
      "Primer za kolonu „Primena“",
    ],
    ...ref.vehicles.generations.map((g) => {
      const example = formatFitments(ref.vehicles, [
        { brandId: g.brandId, modelId: g.modelId, generationId: g.id },
      ]);
      return [
        brands.get(g.brandId) ?? "",
        models.get(g.modelId) ?? "",
        g.name,
        `${g.yearFrom}–${g.yearTo ?? ""}`,
        (linked.get(g.id) ?? []).join("; "),
        example,
      ];
    }),
  ]);
  vehicles["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 11 },
    { wch: 80 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(book, vehicles, "Vozila");
  return write(book);
}

export type ExportProduct = {
  sku: string;
  name: string;
  category: string;
  manufacturer: string;
  quality: "original" | "oem" | "aftermarket";
  oem: readonly string[];
  mpn: string | null;
  cross: readonly string[];
  retailPricePara: number;
  costNetPara: number | null;
  stockQty: number;
  leadTimeDays: number | null;
  fitments: readonly FitmentRef[];
  description: string | null;
  images: readonly string[];
  weightGrams: number | null;
  ean: string | null;
  active: boolean;
  lowStockThreshold: number | null;
};

/** Product export with the template's columns — it imports back without changes. */
export function buildProductsWorkbook(
  rows: readonly ExportProduct[],
  vehicles: VehicleRef,
): Uint8Array {
  const cell: Record<ImportField, (p: ExportProduct) => string | number | null> = {
    sku: (p) => p.sku,
    name: (p) => p.name,
    category: (p) => p.category,
    manufacturer: (p) => p.manufacturer,
    quality: (p) => p.quality,
    oem: (p) => p.oem.join("; ") || null,
    mpn: (p) => p.mpn,
    cross: (p) => p.cross.join("; ") || null,
    priceRetail: (p) => p.retailPricePara / 100,
    priceNet: () => null,
    cost: (p) => (p.costNetPara === null ? null : p.costNetPara / 100),
    stock: (p) => p.stockQty,
    leadTimeDays: (p) => p.leadTimeDays,
    fitment: (p) => formatFitments(vehicles, p.fitments) || null,
    description: (p) => p.description,
    images: (p) => p.images.join("; ") || null,
    weight: (p) => (p.weightGrams === null ? null : p.weightGrams / 1000),
    ean: (p) => p.ean,
    active: (p) => (p.active ? "da" : "ne"),
    lowStockThreshold: (p) => p.lowStockThreshold,
  };
  const sheet = headerSheet(
    rows.map((p) => TEMPLATE_FIELDS.map((f) => cell[f](p))),
    false,
  );
  // Prices as numbers with two decimals; SKUs and EANs stay text.
  rows.forEach((p, i) => {
    for (const field of ["priceRetail", "cost"] as const) {
      const c = sheet[XLSX.utils.encode_cell({ r: i + 1, c: TEMPLATE_FIELDS.indexOf(field) })] as
        XLSX.CellObject | undefined;
      if (c && c.t === "n") c.z = "#,##0.00";
    }
  });
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const book = XLSX.utils.book_new();
  book.Props = { Title: "Proizvodi", Author: "SKLOP" };
  XLSX.utils.book_append_sheet(book, sheet, "Proizvodi");
  return write(book);
}

export type ReportRow = {
  rowNumber: number;
  sku: string | null;
  action: string;
  errors: readonly { field?: string; message: string }[];
  warnings: readonly { field?: string; message: string }[];
};

const ACTION_LABEL: Readonly<Record<string, string>> = {
  create: "Nov artikal",
  update: "Izmena",
  unchanged: "Bez promena",
  skip: "Preskočen",
  error: "Greška",
};

/** One line per problem: row, SKU, planned action, kind, field and message. */
export function buildReportWorkbook(fileName: string, rows: readonly ReportRow[]): Uint8Array {
  const label = (field?: string) =>
    field && field in FIELD_BY_KEY ? FIELD_BY_KEY[field as ImportField].label : (field ?? "");
  const lines: (string | number)[][] = [
    ["Red u fajlu", "Šifra", "Status reda", "Vrsta", "Kolona", "Opis"],
  ];
  for (const r of rows) {
    for (const e of r.errors)
      lines.push([
        r.rowNumber,
        r.sku ?? "",
        ACTION_LABEL[r.action] ?? r.action,
        "Greška",
        label(e.field),
        e.message,
      ]);
    for (const w of r.warnings)
      lines.push([
        r.rowNumber,
        r.sku ?? "",
        ACTION_LABEL[r.action] ?? r.action,
        "Upozorenje",
        label(w.field),
        w.message,
      ]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(lines);
  sheet["!cols"] = [{ wch: 11 }, { wch: 18 }, { wch: 13 }, { wch: 12 }, { wch: 20 }, { wch: 100 }];
  sheet["!autofilter"] = { ref: `A1:F${lines.length}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  const book = XLSX.utils.book_new();
  book.Props = { Title: `Izveštaj o uvozu — ${fileName}`, Author: "SKLOP" };
  XLSX.utils.book_append_sheet(book, sheet, "Greške i upozorenja");
  return write(book);
}
