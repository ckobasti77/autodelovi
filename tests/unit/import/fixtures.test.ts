import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { autoMap } from "@/lib/import/headers";
import { validateRow, type RefCategory, type RefManufacturer } from "@/lib/import/row";
import {
  dataRows,
  guessHeaderRow,
  headersOf,
  loadWorkbook,
  mapRow,
  pickSheet,
} from "@/lib/excel/importSheet";

import { context } from "./refs";

const dir = path.resolve("tests/fixtures/import");
const read = (name: string) => new Uint8Array(readFileSync(path.join(dir, name)));

const CATEGORY_NAMES = [
  "Kočioni diskovi",
  "Kočione pločice",
  "Filter ulja",
  "Filter vazduha",
  "Filter goriva",
  "Alternator",
  "Kaiš alternatora i zatezači",
  "Set zupčastog kaiša i vodena pumpa",
];
const categories: RefCategory[] = CATEGORY_NAMES.map((name, i) => ({
  id: `c${i}`,
  name,
  slug: `c-${i}`,
}));
const manufacturers: RefManufacturer[] = [
  "ATE",
  "Brembo",
  "Bosch",
  "Febi Bilstein",
  "Mann-Filter",
  "TRW",
  "Valeo",
  "Gates",
].map((name, i) => ({ id: `m${i}`, name, slug: `m-${i}`, aliases: [] }));

describe("proizvodi-500.xlsx", () => {
  const wb = loadWorkbook(read("proizvodi-500.xlsx"), "proizvodi-500.xlsx");
  const rows = wb.sheets.get(pickSheet(wb))!;
  const headerRow = guessHeaderRow(rows);
  const mapping = autoMap(headersOf(rows, headerRow));
  const data = dataRows(rows, headerRow);

  it("finds the header below the title block and maps every column by synonyms", () => {
    expect(headerRow).toBe(3);
    expect(mapping.map((m) => m.field)).toEqual([
      "sku",
      "name",
      "category",
      "manufacturer",
      "oem",
      "priceRetail",
      "stock",
      "fitment",
      "images",
      "active",
    ]);
    expect(data).toHaveLength(500);
    expect(data[0]!.rowNumber).toBe(5);
  });

  it("contains exactly the seeded problems", () => {
    const ctx = context({ categories, manufacturers });
    const seen = new Set<string>();
    const codes: string[] = [];
    let duplicates = 0;
    for (const row of data) {
      const r = validateRow(mapRow(row.cells, mapping), ctx);
      for (const e of r.errors) codes.push(e.code);
      for (const w of r.warnings) codes.push(w.code);
      if (r.data.sku && seen.has(r.data.sku)) duplicates++;
      if (r.data.sku) seen.add(r.data.sku);
      expect(r.data.active).toBe(false);
    }
    const count = (code: string) => codes.filter((c) => c === code).length;
    expect(count("PRICE_INVALID")).toBe(2);
    expect(count("CATEGORY_UNKNOWN")).toBe(2);
    expect(count("STOCK_NEGATIVE")).toBe(2);
    expect(count("IMAGE_URL_INVALID")).toBe(2);
    expect(count("FITMENT_UNMATCHED")).toBe(3);
    expect(duplicates).toBe(2);
  });
});

describe("proizvodi-1250.csv", () => {
  it("decodes Windows-1250 with `;` and keeps every Serbian letter", () => {
    const wb = loadWorkbook(read("proizvodi-1250.csv"), "proizvodi-1250.csv");
    expect(wb).toMatchObject({ format: "csv", encoding: "windows-1250", delimiter: ";" });
    const rows = wb.sheets.get("CSV")!;
    const mapping = autoMap(headersOf(rows, 0));
    expect(mapping.map((m) => m.field)).toEqual([
      "sku",
      "name",
      "category",
      "manufacturer",
      "oem",
      "priceRetail",
      "stock",
    ]);
    const data = dataRows(rows, 0);
    expect(data).toHaveLength(20);
    const text = data.map((d) => String(d.cells[1])).join(" ");
    for (const letter of ["č", "ć", "ž", "š", "đ", "Č", "Ć", "Ž", "Š", "Đ", "„", "–"])
      expect(text).toContain(letter);
    const r = validateRow(mapRow(data[0]!.cells, mapping), context({ categories, manufacturers }));
    expect(r.errors).toEqual([]);
    expect(r.data.retailPricePara).toBe(112_345);
  });
});

describe("lager-cene.xlsx", () => {
  it("maps only stock and price columns", () => {
    const wb = loadWorkbook(read("lager-cene.xlsx"), "lager-cene.xlsx");
    const rows = wb.sheets.get(pickSheet(wb))!;
    expect(autoMap(headersOf(rows, 0)).map((m) => m.field)).toEqual([
      "sku",
      "stock",
      "priceRetail",
    ]);
    expect(dataRows(rows, 0)).toHaveLength(22);
  });
});
