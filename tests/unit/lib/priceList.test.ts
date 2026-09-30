import * as XLSX from "xlsx";
import { describe, expect, test } from "vitest";

import {
  buildPriceListWorkbook,
  PRICE_LIST_HEADERS,
  priceListFileName,
  TITLE_ROWS,
  type PriceListRow,
} from "@/lib/excel/priceList";

const row = (overrides: Partial<PriceListRow> = {}): PriceListRow => ({
  sku: "DEMO-KD-001",
  slug: "kocioni-disk-prednji-312",
  name: "Kočioni disk prednji 312 mm",
  manufacturerName: "ATE",
  quality: "oem",
  oemPrimary: "5Q0 615 301 F",
  categoryName: "Kočioni diskovi",
  retailPricePara: 1_299_000,
  unitPricePara: 1_104_200,
  discountBp: 1_500,
  stockState: "in_stock",
  leadTimeDays: null,
  ...overrides,
});

describe("price list workbook", () => {
  test("title block, Serbian headers, numeric prices with formats, links", () => {
    const bytes = buildPriceListWorkbook(
      {
        companyName: "Auto servis Zvezdara",
        tierName: "Majstor Plus",
        discountBp: 1_500,
        generatedAt: Date.UTC(2026, 8, 30, 10),
        siteUrl: "https://sklop.rs",
        truncated: false,
      },
      [row(), row({ sku: "DEMO-TU-002", retailPricePara: 5_000_050, unitPricePara: 4_250_000, discountBp: 1_250, stockState: "on_order", leadTimeDays: 5 })],
    );
    const book = XLSX.read(bytes, { type: "array", cellNF: true });
    const sheet = book.Sheets["Cenovnik"]!;
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });
    expect(rows[0]![0]).toBe("Cenovnik — Auto servis Zvezdara");
    expect(rows[1]![0]).toBe("Nivo: Majstor Plus · osnovni rabat 15 %");
    expect(String(rows[2]![0])).toContain("30.09.2026.");
    expect(rows[TITLE_ROWS]).toEqual([...PRICE_LIST_HEADERS]);
    const first = rows[TITLE_ROWS + 1]!;
    expect(first.slice(0, 6)).toEqual([
      "DEMO-KD-001",
      "Kočioni disk prednji 312 mm",
      "ATE",
      "OEM kvalitet",
      "5Q0 615 301 F",
      "Kočioni diskovi",
    ]);
    expect(first[6]).toBe(12_990);
    expect(first[7]).toBe(11_042);
    expect(first[8]).toBe(0.15);
    expect(first[9]).toBe("Na stanju");
    expect(first[11]).toBe("https://sklop.rs/deo/kocioni-disk-prednji-312");
    const second = rows[TITLE_ROWS + 2]!;
    expect(second[6]).toBe(50_000.5);
    expect(second[9]).toBe("Po porudžbini");
    expect(second[10]).toBe(5);
    const cell = (r: number, c: number) => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject;
    expect(cell(TITLE_ROWS + 1, 6).z).toBe("#,##0");
    expect(cell(TITLE_ROWS + 2, 6).z).toBe("#,##0.00");
    expect(cell(TITLE_ROWS + 2, 8).z).toBe("0.0%");
    expect(cell(TITLE_ROWS + 1, 11).l?.Target).toBe("https://sklop.rs/deo/kocioni-disk-prednji-312");
    expect(sheet["!autofilter"]?.ref).toBe("A5:L7");
  });

  test("file name", () => {
    expect(priceListFileName("auto-servis-zvezdara", "2026-09-30")).toBe("cenovnik-auto-servis-zvezdara-2026-09-30.xlsx");
    expect(priceListFileName("", "2026-09-30")).toBe("cenovnik-2026-09-30.xlsx");
  });
});
