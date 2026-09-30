/**
 * `GET /admin/izvoz/[vrsta]` — staff exports (docs/IMPORT.md §K5):
 * `proizvodi.xlsx` (template columns, imports back unchanged; `?demo=1` includes demo data),
 * `porudzbine.csv` (`?od=YYYY-MM-DD&do=YYYY-MM-DD`), `kupci.csv`, `majstori.csv`.
 * CSV files are UTF-8 with a BOM and `;`, the way Serbian Excel opens them.
 */
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import type { NextRequest } from "next/server";

import { api } from "@/convex/_generated/api";
import { compactDateTime, toCsv } from "@/lib/admin/format";
import { belgradeDay, belgradeLocalToUtc } from "@/lib/domain/time";
import { buildProductsWorkbook, XLSX_TYPE } from "@/lib/excel/importWorkbooks";
import { formatPhone } from "@/lib/format/phone";
import {
  ADMIN_ORDER_STATUS,
  CUSTOMER_TYPE_LABEL,
  ORDER_SOURCE_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/i18n/sr/admin";
import { DELIVERY_LABEL, PAYMENT_LABEL } from "@/lib/i18n/sr/shop";
import { attachment, CSV_TYPE, plainResponse, tokenOrSignIn } from "@/lib/server/adminDownload";

const PAGE = 200;
const MAX = 100_000;

const money = (para: number | null) =>
  para === null ? "" : (para / 100).toFixed(2).replace(".", ",");

function day(value: string | null, end = false): number | undefined {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!m) return undefined;
  const start = belgradeLocalToUtc(Number(m[1]), Number(m[2]), Number(m[3]));
  return end ? start + 86_400_000 - 1 : start;
}

type Page<T> = { page: T[]; isDone: boolean; continueCursor: string };

async function collect<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  while (out.length < MAX) {
    const page = await fetchPage(cursor);
    out.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return out;
}

const MECHANIC_STATUS: Readonly<Record<string, string>> = {
  pending: "na čekanju",
  approved: "odobren",
  rejected: "odbijen",
  suspended: "suspendovan",
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/admin/izvoz/[vrsta]">,
): Promise<Response> {
  const token = await tokenOrSignIn(request);
  if (token instanceof Response) return token;
  const { vrsta } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const stamp = belgradeDay(Date.now());
  try {
    if (vrsta === "proizvodi.xlsx") {
      const includeDemo = params.get("demo") === "1";
      type Row = FunctionReturnType<typeof api.exportsAdmin.productsPage>["page"][number];
      const [reference, rows] = await Promise.all([
        fetchQuery(api.imports.reference, {}, { token }),
        collect<Row>((cursor) =>
          fetchQuery(
            api.exportsAdmin.productsPage,
            { paginationOpts: { numItems: PAGE, cursor }, includeDemo },
            { token },
          ),
        ),
      ]);
      const bytes = buildProductsWorkbook(rows, reference.vehicles);
      return attachment(bytes, `proizvodi-${stamp}.xlsx`, XLSX_TYPE);
    }
    if (vrsta === "porudzbine.csv") {
      const from = day(params.get("od"));
      const to = day(params.get("do"), true);
      type Row = FunctionReturnType<typeof api.exportsAdmin.ordersPage>["page"][number];
      const rows = await collect<Row>((cursor) =>
        fetchQuery(
          api.exportsAdmin.ordersPage,
          {
            paginationOpts: { numItems: PAGE, cursor },
            ...(from !== undefined ? { from } : {}),
            ...(to !== undefined ? { to } : {}),
          },
          { token },
        ),
      );
      const csv = toCsv([
        [
          "Broj",
          "Datum",
          "Status",
          "Tip kupca",
          "Ime",
          "Prezime",
          "Telefon",
          "E-pošta",
          "Firma",
          "PIB",
          "Komada",
          "Artikli (RSD)",
          "Popust (RSD)",
          "Dostava (RSD)",
          "PDV (RSD)",
          "Ukupno (RSD)",
          "Plaćanje",
          "Plaćeno",
          "Isporuka",
          "Grad",
          "Broj pošiljke",
          "Izvor",
          "Kampanja",
          "Demo",
        ],
        ...rows.map((o) => [
          o.number,
          compactDateTime(o.createdAt, 0),
          ADMIN_ORDER_STATUS[o.status].label,
          CUSTOMER_TYPE_LABEL[o.customerType],
          o.firstName,
          o.lastName,
          formatPhone(o.phone),
          o.email,
          o.companyName ?? "",
          o.companyPib ?? "",
          o.itemCount,
          money(o.itemsPara),
          money(o.discountPara),
          money(o.deliveryPara),
          money(o.vatPara),
          money(o.totalPara),
          PAYMENT_LABEL[o.paymentMethod],
          PAYMENT_STATUS_LABEL[o.paymentStatus as keyof typeof PAYMENT_STATUS_LABEL] ??
            o.paymentStatus,
          DELIVERY_LABEL[o.deliveryMethod],
          o.city ?? "",
          o.trackingNumber ?? "",
          ORDER_SOURCE_LABEL[o.source as keyof typeof ORDER_SOURCE_LABEL] ?? o.source,
          o.campaign ?? "",
          o.isDemo ? "da" : "",
        ]),
      ]);
      return attachment(csv, `porudzbine-${stamp}.csv`, CSV_TYPE);
    }
    if (vrsta === "kupci.csv") {
      type Row = FunctionReturnType<typeof api.exportsAdmin.customersPage>["page"][number];
      const rows = await collect<Row>((cursor) =>
        fetchQuery(
          api.exportsAdmin.customersPage,
          { paginationOpts: { numItems: PAGE, cursor } },
          { token },
        ),
      );
      const csv = toCsv([
        [
          "Ime",
          "Prezime",
          "E-pošta",
          "Telefon",
          "Registrovan",
          "Majstor",
          "Pristanak na obaveštenja",
          "Blokiran",
          "Porudžbina",
          "Demo",
        ],
        ...rows.map((u) => [
          u.firstName ?? "",
          u.lastName ?? "",
          u.email ?? "",
          u.phone ? formatPhone(u.phone) : "",
          compactDateTime(u.createdAt, 0),
          u.mechanicStatus === "none"
            ? ""
            : (MECHANIC_STATUS[u.mechanicStatus] ?? u.mechanicStatus),
          u.marketingConsent ? "da" : "ne",
          u.blocked ? "da" : "",
          u.orderCount,
          u.isDemo ? "da" : "",
        ]),
      ]);
      return attachment(csv, `kupci-${stamp}.csv`, CSV_TYPE);
    }
    if (vrsta === "majstori.csv") {
      type Row = FunctionReturnType<typeof api.exportsAdmin.mechanicsPage>["page"][number];
      const rows = await collect<Row>((cursor) =>
        fetchQuery(
          api.exportsAdmin.mechanicsPage,
          { paginationOpts: { numItems: PAGE, cursor } },
          { token },
        ),
      );
      const csv = toCsv([
        [
          "Firma",
          "PIB",
          "MB",
          "Kontakt",
          "Telefon",
          "E-pošta",
          "Grad",
          "Adresa",
          "Status",
          "Razred",
          "Odloženo plaćanje",
          "Limit (RSD)",
          "Rok plaćanja (dana)",
          "Registrovan",
          "Demo",
        ],
        ...rows.map((m) => [
          m.companyName,
          m.pib,
          m.mb,
          m.contactPerson,
          formatPhone(m.phone),
          m.email,
          m.city,
          m.address,
          MECHANIC_STATUS[m.status] ?? m.status,
          m.tierName ?? "",
          m.creditEnabled ? "da" : "ne",
          money(m.creditLimitPara),
          m.paymentTermsDays,
          compactDateTime(m.createdAt, 0),
          m.isDemo ? "da" : "",
        ]),
      ]);
      return attachment(csv, `majstori-${stamp}.csv`, CSV_TYPE);
    }
  } catch {
    return plainResponse(403, "Izvoz je dostupan osoblju.");
  }
  return plainResponse(404, "Nepoznat izvoz.");
}
