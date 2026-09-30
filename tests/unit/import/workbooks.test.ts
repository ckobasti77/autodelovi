import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { encodeWindows1250 } from "@/lib/import/csv";
import { autoMap } from "@/lib/import/headers";
import { validateRow } from "@/lib/import/row";
import { dataRows, guessHeaderRow, headersOf, loadWorkbook, mapRow, pickSheet } from "@/lib/excel/importSheet";
import {
  buildProductsWorkbook,
  buildReportWorkbook,
  buildTemplateWorkbook,
  type ExportProduct,
} from "@/lib/excel/importWorkbooks";

import { CATEGORIES, MANUFACTURERS, VEHICLES, context } from "./refs";

const PRODUCT: ExportProduct = {
  sku: "00123",
  name: "Kočioni disk prednji 312 × 25 mm",
  category: "Kočioni diskovi",
  manufacturer: "ATE",
  quality: "oem",
  oem: ["5Q0 615 301 F", "1K0 615 301 AA"],
  mpn: "24.0125-0184.1",
  cross: ["Febi Bilstein 12345678"],
  retailPricePara: 1_299_050,
  costNetPara: 700_000,
  stockQty: 4,
  leadTimeDays: 3,
  fitments: [
    { brandId: "b-vw", modelId: "m-golf", generationId: "g-golf7", engineId: "e-20tdi110" },
    { brandId: "b-skoda", modelId: "m-octavia", generationId: "g-oct3" },
  ],
  description: "Ventilirani disk.\nMenja se u paru.",
  images: ["https://cdn.primer.rs/disk.jpg"],
  weightGrams: 5400,
  ean: "4006633123456",
  active: true,
  lowStockThreshold: 2,
};

describe("template", () => {
  it("has the five sheets and headers that map exactly", () => {
    const bytes = buildTemplateWorkbook({
      categories: CATEGORIES,
      manufacturers: MANUFACTURERS,
      vehicles: VEHICLES,
    });
    const wb = loadWorkbook(bytes, "sablon.xlsx");
    expect([...wb.sheets.keys()]).toEqual(["Proizvodi", "Uputstvo", "Kategorije", "Proizvođači", "Vozila"]);
    expect(pickSheet(wb)).toBe("Proizvodi");
    const rows = wb.sheets.get("Proizvodi")!;
    const mapped = autoMap(headersOf(rows, 0));
    expect(mapped.every((m) => m.confidence === "exact")).toBe(true);
    // Repeated category names are listed with their group.
    const cats = wb.sheets.get("Kategorije")!;
    expect(cats.some((r) => r[2] === "Motor › Senzori")).toBe(true);
    // Header cells carry hidden comments.
    const raw = XLSX.read(bytes, { type: "array" });
    expect((raw.Sheets.Proizvodi!.A1 as XLSX.CellObject).c?.[0]?.t).toContain("Obavezno");
  });
});

describe("product export round-trip", () => {
  it("imports back to the same values", () => {
    const bytes = buildProductsWorkbook([PRODUCT], VEHICLES);
    const wb = loadWorkbook(bytes, "proizvodi.xlsx");
    const rows = wb.sheets.get(pickSheet(wb))!;
    const headerRow = guessHeaderRow(rows);
    const mapping = autoMap(headersOf(rows, headerRow));
    const [row] = dataRows(rows, headerRow);
    const result = validateRow(mapRow(row!.cells, mapping), context());
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      sku: "00123",
      name: PRODUCT.name,
      categoryId: "c-disk",
      manufacturerId: "mf-ate",
      quality: "oem",
      oemNumbers: PRODUCT.oem,
      mpn: PRODUCT.mpn,
      crossNumbers: [{ manufacturer: "Febi Bilstein", raw: "12345678" }],
      retailPricePara: 1_299_050,
      costNetPara: 700_000,
      stockQty: 4,
      leadTimeDays: 3,
      description: PRODUCT.description,
      images: PRODUCT.images,
      weightGrams: 5400,
      ean: PRODUCT.ean,
      active: true,
      lowStockThreshold: 2,
    });
    expect(result.data.fitments).toEqual(PRODUCT.fitments);
  });
});

describe("csv loading", () => {
  it("reads a Windows-1250 file with `;` and keeps text cells as written", () => {
    const text = "Šifra;Naziv;MP cena;Količina\r\n00123;Kočione pločice „ŽŠĐ“;12.990,00;3\r\n;;;\r\nX-2;Čep ćevapa;1.234,5;0\r\n";
    const wb = loadWorkbook(encodeWindows1250(text), "lager.csv");
    expect(wb).toMatchObject({ format: "csv", encoding: "windows-1250", delimiter: ";" });
    const rows = wb.sheets.get("CSV")!;
    const data = dataRows(rows, 0);
    expect(data.map((d) => d.rowNumber)).toEqual([2, 4]);
    expect(data[0]!.cells).toEqual(["00123", "Kočione pločice „ŽŠĐ“", "12.990,00", "3"]);
  });
});

describe("error report", () => {
  it("writes one line per problem", () => {
    const bytes = buildReportWorkbook("x.xlsx", [
      {
        rowNumber: 7,
        sku: "A-1",
        action: "error",
        errors: [{ field: "priceRetail", message: "Cena „12,99a“ nije ispravan broj." }],
        warnings: [{ field: "images", message: "Adresa slike nije ispravna." }],
      },
    ]);
    const rows = loadWorkbook(bytes, "r.xlsx").sheets.get("Greške i upozorenja")!;
    expect(rows[1]).toEqual([7, "A-1", "Greška", "Greška", "MP cena (sa PDV)", "Cena „12,99a“ nije ispravan broj."]);
    expect(rows[2]?.[3]).toBe("Upozorenje");
  });
});
