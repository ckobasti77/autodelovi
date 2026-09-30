/**
 * Import worker (docs/IMPORT.md §K1): parses the uploaded workbook off the main thread,
 * keeps it in memory, and answers previews, a full validation pass (the same validator
 * Convex runs) and raw mapped rows for staging.
 */
import { buildVehicleIndex } from "../import/fitmentText";
import { mappingIndex } from "../import/fields";
import { normalizeHeader } from "../import/headers";
import { detectNumberFormat } from "../import/numbers";
import { validateRow, type CellValue } from "../import/row";
import type {
  ParsedSheet,
  RowProblem,
  ValidationInput,
  ValidationSummary,
  WorkerRequest,
  WorkerResponse,
} from "./importProtocol";
import {
  dataRows,
  guessHeaderRow,
  headersOf,
  loadWorkbook,
  mapRow,
  pickSheet,
  type LoadedWorkbook,
} from "./importSheet";

// The worker global, typed narrowly (the DOM and WebWorker libs cannot share one program).
const scope = globalThis as unknown as {
  postMessage: (message: WorkerResponse) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

let workbook: LoadedWorkbook | null = null;
let rowsCache: { rowNumber: number; cells: CellValue[] }[] = [];

const MAX_PROBLEMS = 5_000;

function post(message: WorkerResponse) {
  scope.postMessage(message);
}

function describe(sheet: string, headerRow: number): ParsedSheet {
  if (!workbook) throw new Error("Fajl nije učitan.");
  const rows = workbook.sheets.get(sheet) ?? [];
  rowsCache = dataRows(rows, headerRow);
  return {
    format: workbook.format,
    ...(workbook.encoding ? { encoding: workbook.encoding } : {}),
    ...(workbook.delimiter ? { delimiter: workbook.delimiter } : {}),
    sheets: [...workbook.sheets.keys()],
    sheet,
    headerRow,
    headers: headersOf(rows, headerRow),
    preview: rowsCache.slice(0, 50).map((r) => r.cells),
    rowCount: rowsCache.length,
    top: rows.slice(0, 12),
  };
}

function validate(input: ValidationInput): ValidationSummary {
  const ctx = {
    mode: input.mode,
    numberFormat: input.numberFormat,
    warnAmbiguous: input.warnAmbiguous,
    vatRateBp: input.vatRateBp,
    categories: input.categories,
    manufacturers: input.manufacturers,
    vehicles: buildVehicleIndex(input.vehicles),
    ...(input.valueMaps ? { valueMaps: input.valueMaps } : {}),
  };
  const seen = new Map<string, number>();
  const problems: RowProblem[] = [];
  const unknownCategories = new Map<
    string,
    { value: string; count: number; suggestions: string[] }
  >();
  const unknownManufacturers = new Map<string, { value: string; count: number }>();
  let ok = 0;
  let withWarnings = 0;
  let withErrors = 0;
  let duplicates = 0;
  for (const row of rowsCache) {
    const result = validateRow(mapRow(row.cells, input.mapping), ctx);
    const errors = [...result.errors];
    const sku = result.data.sku;
    if (sku) {
      const first = seen.get(sku);
      if (first !== undefined) {
        duplicates++;
        errors.push({
          code: "SKU_DUPLICATE",
          field: "sku",
          message: `Šifra ${sku} se ponavlja u fajlu (prvi put u redu ${first}).`,
        });
      } else seen.set(sku, row.rowNumber);
    }
    if (result.unknownCategory) {
      const key = normalizeHeader(result.unknownCategory.value);
      const entry = unknownCategories.get(key) ?? { ...result.unknownCategory, count: 0 };
      entry.count++;
      unknownCategories.set(key, entry);
    }
    if (result.unknownManufacturer) {
      const key = normalizeHeader(result.unknownManufacturer);
      const entry = unknownManufacturers.get(key) ?? {
        value: result.unknownManufacturer,
        count: 0,
      };
      entry.count++;
      unknownManufacturers.set(key, entry);
    }
    if (errors.length > 0) withErrors++;
    else if (result.warnings.length > 0) withWarnings++;
    else ok++;
    if ((errors.length > 0 || result.warnings.length > 0) && problems.length < MAX_PROBLEMS) {
      problems.push({
        rowNumber: row.rowNumber,
        sku: sku ?? null,
        errors,
        warnings: result.warnings,
      });
    }
  }
  return {
    rows: rowsCache.length,
    ok,
    withWarnings,
    withErrors,
    duplicates,
    problems,
    unknownCategories: [...unknownCategories.values()].sort((a, b) => b.count - a.count),
    unknownManufacturers: [...unknownManufacturers.values()].sort((a, b) => b.count - a.count),
  };
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case "parse": {
        workbook = loadWorkbook(new Uint8Array(req.bytes), req.fileName, req.encoding);
        const sheet = pickSheet(workbook);
        const headerRow = guessHeaderRow(workbook.sheets.get(sheet) ?? []);
        post({ type: "parsed", id: req.id, sheet: describe(sheet, headerRow) });
        return;
      }
      case "select":
        post({ type: "parsed", id: req.id, sheet: describe(req.sheet, req.headerRow) });
        return;
      case "evidence": {
        const index = mappingIndex(req.mapping);
        const columns = [
          index.priceRetail,
          index.priceNet,
          index.cost,
          index.stock,
          index.weight,
        ].filter((c): c is number => c !== undefined);
        const cells = rowsCache
          .slice(0, 2_000)
          .flatMap((r) => columns.map((c) => r.cells[c] ?? null));
        post({ type: "evidence", id: req.id, evidence: detectNumberFormat(cells) });
        return;
      }
      case "validate":
        post({ type: "validated", id: req.id, summary: validate(req.input) });
        return;
      case "rows": {
        const slice = rowsCache.slice(req.from, req.from + req.count);
        post({
          type: "rows",
          id: req.id,
          rows: slice.map((r) => ({ rowNumber: r.rowNumber, cells: mapRow(r.cells, req.mapping) })),
          done: req.from + req.count >= rowsCache.length,
        });
        return;
      }
    }
  } catch (error) {
    post({
      type: "error",
      id: req.id,
      message:
        error instanceof Error && /password|encrypt/i.test(error.message)
          ? "Fajl je zaštićen lozinkom — sačuvajte ga bez lozinke."
          : "Fajl nije mogao da se pročita. Proverite da li je xlsx, xls ili csv.",
    });
  }
};

export {};
