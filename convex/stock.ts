/**
 * Stock records for staff: movement log and low-stock list (docs/DATA-MODEL.md §C8).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { invalid, notFound } from "./lib/errors";
import { staffMutation, staffQuery } from "./lib/functions";
import { updateProduct } from "./lib/productWriter";
import { actorV, stockReasonV, stockStateV } from "./lib/validators";

const movementV = v.object({
  _id: v.id("stockMovements"),
  productId: v.id("products"),
  delta: v.number(),
  qtyBefore: v.number(),
  qtyAfter: v.number(),
  reason: stockReasonV,
  refId: v.union(v.string(), v.null()),
  actor: actorV,
  note: v.union(v.string(), v.null()),
  at: v.number(),
});

export const movements = staffQuery({
  args: { productId: v.optional(v.id("products")), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(movementV),
  handler: async (ctx, { productId, paginationOpts }) => {
    const result = productId
      ? await ctx.db
          .query("stockMovements")
          .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db
          .query("stockMovements")
          .withIndex("by_at")
          .order("desc")
          .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((m) => ({
        _id: m._id,
        productId: m.productId,
        delta: m.delta,
        qtyBefore: m.qtyBefore,
        qtyAfter: m.qtyAfter,
        reason: m.reason,
        refId: m.refId ?? null,
        actor: m.actor,
        note: m.note ?? null,
        at: m.at,
      })),
    };
  },
});

export const lowStock = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      productId: v.id("products"),
      sku: v.string(),
      name: v.string(),
      stockQty: v.number(),
      stockState: stockStateV,
      threshold: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const out = [];
    for (const state of ["out_of_stock", "low_stock"] as const) {
      const rows = await ctx.db
        .query("products")
        .withIndex("by_stockState_and_active", (q) => q.eq("stockState", state).eq("active", true))
        .take(200);
      for (const p of rows) {
        out.push({
          productId: p._id,
          sku: p.sku,
          name: p.name,
          stockQty: p.stockQty,
          stockState: p.stockState,
          threshold: p.lowStockThreshold ?? null,
        });
      }
    }
    return out;
  },
});

export const setThreshold = staffMutation({
  args: { productId: v.id("products"), threshold: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { productId, threshold }) => {
    if (
      threshold !== null &&
      (!Number.isInteger(threshold) || threshold < 0 || threshold > 10_000)
    ) {
      invalid("Prag 0–10.000.", "threshold");
    }
    const product = await ctx.db.get("products", productId);
    if (!product) return notFound("Artikal ne postoji.");
    const actor = actorOf(ctx.viewer);
    // `undefined` clears the per-product override (falls back to the global default).
    await updateProduct(
      ctx,
      productId,
      { lowStockThreshold: threshold ?? undefined },
      { actor, emit: true },
    );
    await audit(ctx, {
      actor,
      action: "stock.threshold",
      entityType: "product",
      entityId: productId,
      summary: `${product.sku}: prag za malo na stanju ${threshold ?? "podrazumevani"}`,
    });
    return null;
  },
});
