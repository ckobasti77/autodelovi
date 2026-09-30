/**
 * Workbook parsing for imports (docs/IMPORT.md §K1), shared by the Web Worker and the unit
 * tests: xlsx/xls through SheetJS, CSV through our own decoding (UTF-8 vs Windows-1250,
 * delimiter detection) and SheetJS in `raw` mode, so `12.990` and leading zeros stay text.
 */
import * as XLSX from "xlsx";

import { decodeCsvBytes, detectDelimiter, type CsvEncoding } from "../import/csv";
import { mappingIndex, type ColumnMapping, type ImportField } from "../import/fields";
import { detectHeaderRow } from "../import/headers";
import type { CellValue, RawRow } from "../import/row";

export type LoadedWorkbook = {
  format: "xlsx" | "xls" | "csv";
  encoding?: CsvEncoding;
  delimiter?: string;
  sheets: Map<string, CellValue[][]>;
};

type DenseCell = { t?: string; v?: unknown; w?: string; z?: unknown } | undefined;

function cellValue(cell: DenseCell): CellValue {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  switch (cell.t) {
    case "s":
      return String(cell.v).normalize("NFC");
    case "n":
      // Zero-padded number formats (`00123`) keep the displayed text.
      if (typeof cell.z === "string" && /^0+$/.test(cell.z) && cell.w) return cell.w;
      return typeof cell.v === "number" ? cell.v : Number(cell.v);
    case "b":
      return Boolean(cell.v);
    case "d":
      return cell.v instanceof Date ? cell.v.toISOString().slice(0, 10) : String(cell.v);
    case "e":
    case "z":
      return null;
    default:
      return typeof cell.v === "string" ? cell.v.normalize("NFC") : (cell.v as CellValue);
  }
}

function sheetRows(ws: XLSX.WorkSheet): CellValue[][] {
  const dense = (ws as unknown as { "!data"?: DenseCell[][] })["!data"];
  if (dense) {
    return dense.map((row) => (row ? Array.from(row, (c) => cellValue(c)) : []));
  }
  // Sparse fallback (older readers): build rows from the range.
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  const out: CellValue[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: CellValue[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(cellValue(ws[XLSX.utils.encode_cell({ r, c })] as DenseCell));
    }
    out.push(row);
  }
  return out;
}

export function detectFormat(fileName: string, bytes: Uint8Array): "xlsx" | "xls" | "csv" {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "xlsx";
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return "xls";
  const ext = fileName.toLowerCase().split(".").pop();
  return ext === "xls" ? "xls" : ext === "xlsx" ? "xlsx" : "csv";
}

export function loadWorkbook(
  bytes: Uint8Array,
  fileName: string,
  encoding?: CsvEncoding,
): LoadedWorkbook {
  const format = detectFormat(fileName, bytes);
  if (format === "csv") {
    const decoded = decodeCsvBytes(bytes, encoding);
    const delimiter = detectDelimiter(decoded.text);
    const wb = XLSX.read(decoded.text, { type: "string", FS: delimiter, raw: true, dense: true });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    return {
      format,
      encoding: decoded.encoding,
      delimiter,
      sheets: new Map([["CSV", sheetRows(ws)]]),
    };
  }
  const wb = XLSX.read(bytes, { type: "array", cellDates: true, dense: true, cellNF: true });
  const sheets = new Map<string, CellValue[][]>();
  for (const name of wb.SheetNames) sheets.set(name, sheetRows(wb.Sheets[name]!));
  return { format, sheets };
}

const isEmpty = (v: CellValue) => v === null || (typeof v === "string" && v.trim() === "");

/** The sheet most likely to hold products: the first one whose header row maps ≥ 3 fields. */
export function pickSheet(wb: LoadedWorkbook): string {
  for (const [name, rows] of wb.sheets) {
    if (/uputstvo|kategorije|proizvo[dđ]a[cč]i|vozila/i.test(name)) continue;
    if (rows.length > 1) return name;
  }
  return wb.sheets.keys().next().value ?? "";
}

export function headersOf(rows: CellValue[][], headerRow: number): string[] {
  const row = rows[headerRow] ?? [];
  const width = Math.max(
    row.length,
    ...rows.slice(headerRow + 1, headerRow + 30).map((r) => r.length),
  );
  return Array.from({ length: width }, (_, i) => {
    const v = row[i];
    return v === null || v === undefined ? "" : String(v).trim();
  });
}

export function guessHeaderRow(rows: CellValue[][]): number {
  return detectHeaderRow(rows as unknown[][]);
}

/** Data rows after the header that have at least one non-empty cell. */
export function dataRows(
  rows: CellValue[][],
  headerRow: number,
): { rowNumber: number; cells: CellValue[] }[] {
  const out: { rowNumber: number; cells: CellValue[] }[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (cells.every(isEmpty)) continue;
    out.push({ rowNumber: r + 1, cells });
  }
  return out;
}

/** Picks the mapped columns of one row: field → raw cell (empty cells omitted). */
export function mapRow(cells: CellValue[], mapping: ColumnMapping[]): RawRow {
  const index = mappingIndex(mapping);
  const out: RawRow = {};
  for (const [field, column] of Object.entries(index) as [ImportField, number][]) {
    const value = cells[column] ?? null;
    if (!isEmpty(value)) out[field] = value;
  }
  return out;
}
