/**
 * Exact / prefix lookup of normalised part numbers (OEM, cross, MPN, SKU, EAN).
 */
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { normalizeCode } from "../../lib/domain/codes";
import { publicQuery } from "../lib/functions";

export const codeKindV = v.union(
  v.literal("oem"),
  v.literal("cross"),
  v.literal("mpn"),
  v.literal("sku"),
  v.literal("ean"),
);

export const codeHitV = v.object({
  productId: v.id("products"),
  code: v.string(),
  raw: v.string(),
  kind: codeKindV,
  label: v.union(v.string(), v.null()),
});

/** Active code rows for a normalised code (exact) or prefix (≥ 4 chars). */
export async function lookupCodes(
  ctx: QueryCtx,
  normalized: string,
  mode: "exact" | "prefix",
  limit: number,
): Promise<Doc<"productCodes">[]> {
  if (normalized.length < 3) return [];
  if (mode === "exact") {
    const rows = await ctx.db
      .query("productCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .take(limit * 2);
    return rows.filter((r) => r.active).slice(0, limit);
  }
  if (normalized.length < 4) return [];
  const rows = await ctx.db
    .query("productCodes")
    .withIndex("by_code", (q) => q.gte("code", normalized).lt("code", `${normalized}\uffff`))
    .take(limit * 2);
  return rows.filter((r) => r.active).slice(0, limit);
}

export const lookup = publicQuery({
  args: {
    code: v.string(),
    mode: v.optional(v.union(v.literal("exact"), v.literal("prefix"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(codeHitV),
  handler: async (ctx, args) => {
    const normalized = normalizeCode(args.code.slice(0, 60));
    const limit = Math.min(50, Math.max(1, Math.floor(args.limit ?? 20)));
    const rows = await lookupCodes(ctx, normalized, args.mode ?? "exact", limit);
    return rows.map((r) => ({
      productId: r.productId,
      code: r.code,
      raw: r.raw,
      kind: r.kind,
      label: r.label ?? null,
    }));
  },
});
