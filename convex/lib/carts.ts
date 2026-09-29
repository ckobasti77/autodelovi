/**
 * Cart resolution and per-viewer line pricing, shared by `carts.*` and `orders.submit`.
 * Cart prices are never stored — they are computed for the viewer on every read.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { canOrderQuantity } from "../../lib/domain/stock";
import type { Viewer } from "./authz";
import { isListed } from "./catalog";
import { fail, invalid } from "./errors";
import { loadPricingContext, resolveForContext, type CategoryPathCache } from "./pricing";
import { hashToken, isTokenShape } from "./tokens";

export const MAX_CART_LINES = 100;
export const MAX_LINE_QTY = 999;
const GUEST_CART_TTL_MS = 30 * 24 * 3_600_000;

export async function findCart(
  ctx: QueryCtx,
  viewer: Viewer | null,
  guestToken: string | undefined,
): Promise<Doc<"carts"> | null> {
  if (viewer) {
    return await ctx.db
      .query("carts")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", viewer.userId).eq("status", "active"),
      )
      .first();
  }
  if (!guestToken || !isTokenShape(guestToken)) return null;
  const hash = await hashToken(guestToken);
  const cart = await ctx.db
    .query("carts")
    .withIndex("by_guestTokenHash", (q) => q.eq("guestTokenHash", hash))
    .first();
  return cart && cart.status === "active" ? cart : null;
}

export async function getOrCreateCart(
  ctx: MutationCtx,
  viewer: Viewer | null,
  guestToken: string | undefined,
): Promise<Doc<"carts">> {
  const existing = await findCart(ctx, viewer, guestToken);
  if (existing) return existing;
  const now = Date.now();
  if (viewer) {
    const cartId = await ctx.db.insert("carts", {
      ownerType: "user",
      userId: viewer.userId,
      status: "active",
      updatedAt: now,
    });
    return (await ctx.db.get("carts", cartId))!;
  }
  if (!guestToken || !isTokenShape(guestToken)) {
    return invalid("Korpa nije pronađena. Osvežite stranicu.", "guestToken");
  }
  const hash = await hashToken(guestToken);
  const taken = await ctx.db
    .query("carts")
    .withIndex("by_guestTokenHash", (q) => q.eq("guestTokenHash", hash))
    .first();
  // A converted/merged guest token must not be reused for a new cart.
  if (taken) return fail("CONFLICT", "Ova korpa je već poručena. Osvežite stranicu.");
  const cartId = await ctx.db.insert("carts", {
    ownerType: "guest",
    guestTokenHash: hash,
    status: "active",
    updatedAt: now,
    expiresAt: now + GUEST_CART_TTL_MS,
  });
  return (await ctx.db.get("carts", cartId))!;
}

export async function cartItems(ctx: QueryCtx, cartId: Id<"carts">): Promise<Doc<"cartItems">[]> {
  return await ctx.db
    .query("cartItems")
    .withIndex("by_cartId", (q) => q.eq("cartId", cartId))
    .take(MAX_CART_LINES + 1);
}

export type LineNotice =
  | { kind: "unavailable" }
  | { kind: "insufficient_stock"; available: number }
  | { kind: "backorder"; available: number; leadTimeDays: number | null };

export type PricedLine = {
  item: Doc<"cartItems">;
  product: Doc<"products"> | null;
  unitRetailPara: number;
  unitPricePara: number;
  discountBp: number;
  lineTotalPara: number;
  notice: LineNotice | null;
  orderable: boolean;
};

/** Prices every line for the viewer and flags stock problems. */
export async function priceLines(
  ctx: QueryCtx,
  viewer: Viewer | null,
  items: readonly Doc<"cartItems">[],
): Promise<PricedLine[]> {
  const pc = await loadPricingContext(ctx, viewer);
  const cache: CategoryPathCache = new Map();
  const out: PricedLine[] = [];
  for (const item of items) {
    const product = await ctx.db.get("products", item.productId);
    if (!product || !isListed(product)) {
      out.push({
        item,
        product,
        unitRetailPara: 0,
        unitPricePara: 0,
        discountBp: 0,
        lineTotalPara: 0,
        notice: { kind: "unavailable" },
        orderable: false,
      });
      continue;
    }
    const resolved = pc ? await resolveForContext(ctx, pc, product, cache) : null;
    const unitPricePara = resolved?.unitPricePara ?? product.retailPricePara;
    const check = canOrderQuantity(product, item.quantity);
    let notice: LineNotice | null = null;
    if (!check.ok) notice = { kind: "insufficient_stock", available: check.available };
    else if (check.backorder)
      notice = {
        kind: "backorder",
        available: check.available,
        leadTimeDays: product.leadTimeDays ?? null,
      };
    out.push({
      item,
      product,
      unitRetailPara: product.retailPricePara,
      unitPricePara,
      discountBp: resolved?.discountBp ?? 0,
      lineTotalPara: unitPricePara * item.quantity,
      notice,
      orderable: check.ok,
    });
  }
  return out;
}

export function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QTY) {
    invalid("Količina mora biti ceo broj od 1 do 999.", "quantity");
  }
}
