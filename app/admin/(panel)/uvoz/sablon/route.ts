/**
 * `GET /admin/uvoz/sablon` → the import template (.xlsx): „Proizvodi“ with Serbian headers
 * and header comments, „Uputstvo“, and the valid values („Kategorije“, „Proizvođači“,
 * „Vozila“) read from Convex with the staff member's token (docs/IMPORT.md §K5).
 */
import { fetchQuery } from "convex/nextjs";
import type { NextRequest } from "next/server";

import { api } from "@/convex/_generated/api";
import { buildTemplateWorkbook, XLSX_TYPE } from "@/lib/excel/importWorkbooks";
import { attachment, plainResponse, tokenOrSignIn } from "@/lib/server/adminDownload";

export async function GET(request: NextRequest): Promise<Response> {
  const token = await tokenOrSignIn(request);
  if (token instanceof Response) return token;
  let reference;
  try {
    reference = await fetchQuery(api.imports.reference, {}, { token });
  } catch {
    return plainResponse(403, "Šablon je dostupan osoblju.");
  }
  const bytes = buildTemplateWorkbook(reference);
  return attachment(bytes, "sablon-za-uvoz-artikala.xlsx", XLSX_TYPE);
}
