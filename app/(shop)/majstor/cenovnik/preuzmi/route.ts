/**
 * `GET /majstor/cenovnik/preuzmi?kategorije=slug,slug` → the approved mechanic's personal
 * price list as XLSX (ROUTES §B1). The Convex queries run with the mechanic's own token, so
 * prices are his and only his; Convex refuses everyone else (`requireApprovedMechanic`).
 */
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import type { NextRequest } from "next/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { siteUrl } from "@/config/site";
import { belgradeDay } from "@/lib/domain/time";
import { slugifySr } from "@/lib/domain/slug";
import { buildPriceListWorkbook, priceListFileName, type PriceListRow } from "@/lib/excel/priceList";
import { getCategoryTree } from "@/lib/server/catalog-cache";
import { ROUTES } from "@/constants/routes";

const MAX_ROWS = 5_000;
const PAGE_SIZE = 250;
const MAX_SLUGS = 120;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

type Leaf = { id: Id<"categories">; name: string };

/** Selected system / category / subcategory slugs → leaf categories (products attach to leaves). */
async function leavesFor(slugs: readonly string[]): Promise<Leaf[]> {
  const tree = await getCategoryTree();
  const all = [...tree.systems, ...tree.categories, ...tree.subcategories];
  const children = new Map<string, typeof all>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = children.get(c.parentId) ?? [];
    list.push(c);
    children.set(c.parentId, list);
  }
  const out = new Map<string, Leaf>();
  const walk = (c: (typeof all)[number], depth: number) => {
    const kids = children.get(c._id) ?? [];
    if (kids.length === 0 || depth > 3) {
      if (c.kind !== "system") out.set(c._id, { id: c._id as Id<"categories">, name: c.name });
      return;
    }
    for (const k of kids) walk(k, depth + 1);
  };
  for (const slug of slugs) {
    const hit = all.find((c) => c.slug === slug);
    if (hit) walk(hit, 0);
  }
  return [...out.values()];
}

export async function GET(request: NextRequest): Promise<Response> {
  const token = await convexAuthNextjsToken();
  if (!token) {
    const next = encodeURIComponent(ROUTES.mechanicPriceList);
    return Response.redirect(new URL(`${ROUTES.signIn}?next=${next}`, request.nextUrl.origin), 303);
  }
  const slugs = (request.nextUrl.searchParams.get("kategorije") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase().slice(0, 80))
    .filter((s) => /^[a-z0-9-]+$/.test(s))
    .slice(0, MAX_SLUGS);
  if (slugs.length === 0) return plain(400, "Izaberite bar jednu kategoriju.");

  let meta;
  try {
    meta = await fetchQuery(api.mechanicPortal.priceListMeta, {}, { token });
  } catch {
    return plain(403, "Cenovnik je dostupan odobrenim majstorima.");
  }

  const leaves = await leavesFor(slugs);
  // Every slug unknown (an old bookmark, a renamed category): say so instead of an empty file.
  if (leaves.length === 0) {
    return plain(400, "Izabrane kategorije više ne postoje. Vratite se na cenovnik i izaberite ponovo.");
  }
  const rows: PriceListRow[] = [];
  let truncated = false;
  outer: for (const leaf of leaves) {
    let cursor: string | null = null;
    for (;;) {
      const page: FunctionReturnType<typeof api.mechanicPortal.priceListPage> = await fetchQuery(
        api.mechanicPortal.priceListPage,
        { categoryId: leaf.id, paginationOpts: { numItems: PAGE_SIZE, cursor } },
        { token },
      );
      for (const r of page.page) {
        if (rows.length >= MAX_ROWS) {
          truncated = true;
          break outer;
        }
        rows.push({
          sku: r.sku,
          slug: r.slug,
          name: r.name,
          manufacturerName: r.manufacturerName,
          quality: r.quality,
          oemPrimary: r.oemPrimary,
          categoryName: leaf.name,
          retailPricePara: r.retailPricePara,
          unitPricePara: r.unitPricePara,
          discountBp: r.discountBp,
          stockState: r.stockState,
          leadTimeDays: r.leadTimeDays,
        });
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
  }

  const now = Date.now();
  const bytes = buildPriceListWorkbook(
    {
      companyName: meta.companyName,
      tierName: meta.tierName,
      discountBp: meta.personalDiscountBp ?? meta.tierDiscountBp,
      generatedAt: now,
      siteUrl: siteUrl().origin,
      truncated,
    },
    rows,
  );
  const fileName = priceListFileName(slugifySr(meta.companyName).slice(0, 40), belgradeDay(now));
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
