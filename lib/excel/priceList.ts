/**
 * Personal price list workbook (ROUTES §B1 `/majstor/cenovnik/preuzmi`), built with SheetJS
 * CE 0.20.3 (ARCHITECTURE §0.2 — CDN tarball, never the npm-registry `xlsx`). Pure: rows in,
 * bytes out; the route handler loads the rows from Convex with the mechanic's token.
 */
import * as XLSX from "xlsx";

import { formatBelgradeDate } from "@/lib/domain/time";

export type PriceListRow = {
  sku: string;
  slug: string;
  name: string;
  manufacturerName: string;
  quality: "original" | "oem" | "aftermarket";
  oemPrimary: string | null;
  categoryName: string;
  retailPricePara: number;
  unitPricePara: number;
  discountBp: number;
  stockState: "in_stock" | "low_stock" | "out_of_stock" | "on_order";
  leadTimeDays: number | null;
};

export type PriceListMeta = {
  companyName: string;
  tierName: string | null;
  discountBp: number | null;
  generatedAt: number;
  siteUrl: string;
  truncated: boolean;
};

const QUALITY: Record<PriceListRow["quality"], string> = {
  original: "Original VAG",
  oem: "OEM kvalitet",
  aftermarket: "Aftermarket",
};

const STOCK: Record<PriceListRow["stockState"], string> = {
  in_stock: "Na stanju",
  low_stock: "Malo na stanju",
  out_of_stock: "Nema na stanju",
  on_order: "Po porudžbini",
};

export const PRICE_LIST_HEADERS = [
  "Šifra",
  "Naziv",
  "Proizvođač",
  "Kvalitet",
  "OEM broj",
  "Kategorija",
  "MP cena (RSD)",
  "Vaša cena (RSD)",
  "Rabat",
  "Stanje",
  "Rok (dana)",
  "Link",
] as const;

const WIDTHS = [16, 44, 18, 14, 18, 26, 14, 15, 8, 16, 10, 40];

/** Title block rows before the table (1-based index of the header row = TITLE_ROWS + 1). */
export const TITLE_ROWS = 4;

const COL = { retail: 6, yours: 7, rabat: 8, link: 11 } as const;

export function buildPriceListWorkbook(
  meta: PriceListMeta,
  rows: readonly PriceListRow[],
): Uint8Array {
  const tier = [
    meta.tierName ? `Nivo: ${meta.tierName}` : null,
    meta.discountBp !== null ? `osnovni rabat ${meta.discountBp / 100} %` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const note = `Na dan ${formatBelgradeDate(meta.generatedAt)} · cene su u dinarima sa PDV-om · za pojedine kategorije i proizvođače rabat može biti drugačiji${meta.truncated ? " · prikazano je prvih 5.000 artikala" : ""}`;
  const aoa: (string | number | null)[][] = [
    [`Cenovnik — ${meta.companyName}`],
    [tier || "Majstorske cene"],
    [note],
    [],
    [...PRICE_LIST_HEADERS],
    ...rows.map((r) => [
      r.sku,
      r.name,
      r.manufacturerName,
      QUALITY[r.quality],
      r.oemPrimary,
      r.categoryName,
      r.retailPricePara / 100,
      r.unitPricePara / 100,
      r.discountBp / 10_000,
      STOCK[r.stockState],
      r.leadTimeDays || null,
      `${meta.siteUrl}/deo/${r.slug}`,
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Number formats and links on the table cells (Excel shows them with the user's separators).
  rows.forEach((r, i) => {
    const row = TITLE_ROWS + 1 + i;
    const at = (c: number) =>
      sheet[XLSX.utils.encode_cell({ r: row, c })] as XLSX.CellObject | undefined;
    const retail = at(COL.retail);
    if (retail) retail.z = r.retailPricePara % 100 === 0 ? "#,##0" : "#,##0.00";
    const yours = at(COL.yours);
    if (yours) yours.z = r.unitPricePara % 100 === 0 ? "#,##0" : "#,##0.00";
    const rabat = at(COL.rabat);
    if (rabat) rabat.z = r.discountBp % 100 === 0 ? "0%" : "0.0%";
    const link = at(COL.link);
    if (link) link.l = { Target: String(link.v) };
  });
  sheet["!cols"] = WIDTHS.map((wch) => ({ wch }));
  const headerRow = TITLE_ROWS + 1;
  sheet["!autofilter"] = { ref: `A${headerRow}:L${headerRow + rows.length}` };
  sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: 7 } }));

  const book = XLSX.utils.book_new();
  book.Props = { Title: `Cenovnik — ${meta.companyName}`, Author: "SKLOP" };
  XLSX.utils.book_append_sheet(book, sheet, "Cenovnik");
  const out = XLSX.write(book, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  }) as ArrayBuffer;
  return new Uint8Array(out);
}

/** `cenovnik-auto-servis-zvezdara-2026-09-30.xlsx` */
export function priceListFileName(companySlug: string, day: string): string {
  const base = companySlug ? `cenovnik-${companySlug}` : "cenovnik";
  return `${base}-${day}.xlsx`;
}
