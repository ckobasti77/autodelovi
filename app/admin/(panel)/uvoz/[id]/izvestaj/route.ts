/**
 * `GET /admin/uvoz/[id]/izvestaj` → every error and warning of an import batch as .xlsx
 * (one line per problem, with the file's row number) — docs/IMPORT.md §K4 step 3.
 */
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import type { NextRequest } from "next/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildReportWorkbook, XLSX_TYPE, type ReportRow } from "@/lib/excel/importWorkbooks";
import { attachment, plainResponse, tokenOrSignIn } from "@/lib/server/adminDownload";

const PAGE = 500;
const MAX_ROWS = 60_000;

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/admin/uvoz/[id]/izvestaj">,
): Promise<Response> {
  const token = await tokenOrSignIn(request);
  if (token instanceof Response) return token;
  const { id } = await ctx.params;
  const batchId = id as Id<"importBatches">;
  let batch;
  try {
    batch = await fetchQuery(api.imports.batch, { batchId }, { token });
  } catch {
    return plainResponse(403, "Izveštaj je dostupan osoblju.");
  }
  if (!batch) return plainResponse(404, "Uvoz ne postoji.");

  const problems: ReportRow[] = [];
  let cursor: string | null = null;
  for (let seen = 0; seen < MAX_ROWS; seen += PAGE) {
    const page: FunctionReturnType<typeof api.imports.rows> = await fetchQuery(
      api.imports.rows,
      { batchId, paginationOpts: { numItems: PAGE, cursor } },
      { token },
    );
    for (const r of page.page) {
      const errors = r.commitError
        ? [...r.errors, { message: `Upis nije uspeo: ${r.commitError}` }]
        : r.errors;
      if (errors.length > 0 || r.warnings.length > 0)
        problems.push({
          rowNumber: r.rowNumber,
          sku: r.sku,
          action: r.action,
          errors,
          warnings: r.warnings,
        });
    }
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  const base = batch.fileName.replace(/\.(xlsx|xls|csv)$/i, "");
  return attachment(
    buildReportWorkbook(batch.fileName, problems),
    `izvestaj-${base}.xlsx`,
    XLSX_TYPE,
  );
}
