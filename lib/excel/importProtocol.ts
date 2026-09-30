/**
 * Messages between the import wizard and `import.worker.ts` (docs/IMPORT.md §K1). The
 * worker keeps the parsed workbook; the page asks for previews, a validation pass and raw
 * mapped rows for staging, in chunks.
 */
import type { CsvEncoding } from "../import/csv";
import type { ColumnMapping, ImportMode } from "../import/fields";
import type { VehicleRef } from "../import/fitmentText";
import type { FormatEvidence, NumberFormat } from "../import/numbers";
import type {
  CellValue,
  RawRow,
  RefCategory,
  RefManufacturer,
  RowIssue,
  ValueMaps,
} from "../import/row";

export type ParsedSheet = {
  format: "xlsx" | "xls" | "csv";
  encoding?: CsvEncoding;
  delimiter?: string;
  sheets: string[];
  sheet: string;
  headerRow: number;
  headers: string[];
  /** First data rows (after the header), raw cell values. */
  preview: CellValue[][];
  /** Non-empty data rows after the header row. */
  rowCount: number;
  /** First rows of the sheet (for choosing the header row). */
  top: CellValue[][];
};

export type ValidationInput = {
  mapping: ColumnMapping[];
  mode: ImportMode;
  numberFormat: NumberFormat;
  warnAmbiguous: boolean;
  vatRateBp: number;
  categories: RefCategory[];
  manufacturers: RefManufacturer[];
  vehicles: VehicleRef;
  valueMaps?: ValueMaps;
};

export type RowProblem = {
  rowNumber: number;
  sku: string | null;
  errors: RowIssue[];
  warnings: RowIssue[];
};

export type ValidationSummary = {
  rows: number;
  ok: number;
  withWarnings: number;
  withErrors: number;
  duplicates: number;
  /** Rows with problems (first 5 000). */
  problems: RowProblem[];
  unknownCategories: { value: string; count: number; suggestions: string[] }[];
  unknownManufacturers: { value: string; count: number }[];
};

export type WorkerRequest =
  | { type: "parse"; id: number; bytes: ArrayBuffer; fileName: string; encoding?: CsvEncoding }
  | { type: "select"; id: number; sheet: string; headerRow: number }
  | { type: "evidence"; id: number; mapping: ColumnMapping[] }
  | { type: "validate"; id: number; input: ValidationInput }
  | { type: "rows"; id: number; mapping: ColumnMapping[]; from: number; count: number };

export type WorkerResponse =
  | { type: "parsed"; id: number; sheet: ParsedSheet }
  | { type: "evidence"; id: number; evidence: FormatEvidence }
  | { type: "validated"; id: number; summary: ValidationSummary }
  | { type: "rows"; id: number; rows: { rowNumber: number; cells: RawRow }[]; done: boolean }
  | { type: "error"; id: number; message: string };
