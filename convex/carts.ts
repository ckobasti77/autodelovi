/**
 * Carts (docs/DATA-MODEL.md §C6): one active cart per user; guests use a client-held
 * 128-bit token (`sk_cart`, only its hash is stored). Lines are priced per viewer on read.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { canOrderQuantity } from "../lib/domain/stock";
import type { Viewer } from "./lib/authz";
import {
  assertQuantity,
  cartItems,
  findCart,
  getOrCreateCart,
  MAX_CART_LINES,
  MAX_LINE_QTY,
  priceLines,
} from "./lib/carts";
import { isListed, productCardV, toCard } from "./lib/catalog";
import { fail, invalid, notFound } from "./lib/errors";
import { publicMutation, publicQuery, userMutation, type ClientInfo } from "./lib/functions";
import { enforceRateLimit } from "./lib/rateLimits";
import { hashToken, isTokenShape } from "./lib/tokens";
import { cartItemSourceV } from "./lib/validators";

const noticeV = v.union(
  v.null(),
  v.object({ kind: v.literal("unavailable") }),
  v.object({ kind: v.literal("insufficient_stock"), available: v.number() }),
  v.object({
    kind: v.literal("backorder"),
    available: v.number(),
    leadTimeDays: v.union(v.number(), v.null()),
  }),
);

export const get = publicQuery({
  args: { guestToken: v.optional(v.string()) },
  returns: v.object({
    cartId: v.union(v.id("carts"), v.null()),
    lines: v.array(
      v.object({
        itemId: v.id("cartItems"),
        productId: v.id("products"),
        quantity: v.number(),
        product: v.union(productCardV, v.null()),
        unitRetailPara: v.number(),
        unitPricePara: v.number(),
        discountBp: v.number(),
        lineTotalPara: v.number(),
        notice: noticeV,
        orderable: v.boolean(),
      }),
    ),
    itemCount: v.number(),
    itemsRetailPara: v.number(),
    itemsPara: v.number(),
    discountPara: v.number(),
    hasProblems: v.boolean(),
  }),
  handler: async (ctx, { guestToken }) => {
    const cart = await findCart(ctx, ctx.viewer, guestToken);
    const empty = {
      cartId: null,
      lines: [],
      itemCount: 0,
      itemsRetailPara: 0,
      itemsPara: 0,
      discountPara: 0,
      hasProblems: false,
    };
    if (!cart) return empty;
    const items = await cartItems(ctx, cart._id);
    const priced = await priceLines(ctx, ctx.viewer, items);
    const lines = [];
    let itemsRetailPara = 0;
    let itemsPara = 0;
    let itemCount = 0;
    for (const line of priced) {
      lines.push({
        itemId: line.item._id,
        productId: line.item.productId,
        quantity: line.item.quantity,
        // Cart owners always see prices of their own lines.
        product: line.product ? await toCard(ctx, line.product, true) : null,
        unitRetailPara: line.unitRetailPara,
        unitPricePara: line.unitPricePara,
        discountBp: line.discountBp,
        lineTotalPara: line.lineTotalPara,
        notice: line.notice,
        orderable: line.orderable,
      });
      if (line.orderable) {
        itemsRetailPara += line.unitRetailPara * line.item.quantity;
        itemsPara += line.lineTotalPara;
        itemCount += line.item.quantity;
      }
    }
    return {
      cartId: cart._id,
      lines,
      itemCount,
      itemsRetailPara,
      itemsPara,
      discountPara: itemsRetailPara - itemsPara,
      hasProblems: priced.some(
        (l) => l.notice?.kind === "unavailable" || l.notice?.kind === "insufficient_stock",
      ),
    };
  },
});

/** `inCart`: what the cart already holds of this product (0 for a new line or a set). */
async function loadOrderableProduct(
  ctx: MutationCtx,
  productId: Id<"products">,
  quantity: number,
  inCart = 0,
): Promise<Doc<"products">> {
  const product = await ctx.db.get("products", productId);
  if (!product || !isListed(product)) return notFound("Artikal više nije u ponudi.");
  const check = canOrderQuantity(product, quantity);
  if (!check.ok) {
    // „Na stanju je još N kom.“ reads as „N more can be added“ — say what the cart holds
    // when it already has all of it (QA FLOW-25).
    const message =
      check.available <= 0
        ? "Artikal trenutno nije na stanju."
        : inCart >= check.available
          ? `U korpi je već sva raspoloživa količina (${check.available} kom.).`
          : inCart > 0
            ? `Na stanju je ${check.available} kom.; u korpi ih već imate ${inCart}.`
            : `Na stanju je još ${check.available} kom.`;
    fail("OUT_OF_STOCK", message, { available: check.available });
  }
  return product;
}

async function upsertLine(
  ctx: MutationCtx,
  cart: Doc<"carts">,
  productId: Id<"products">,
  quantity: number,
  source: Doc<"cartItems">["source"],
  mode: "add" | "set",
): Promise<void> {
  const existing = await ctx.db
    .query("cartItems")
    .withIndex("by_cartId_and_productId", (q) =>
      q.eq("cartId", cart._id).eq("productId", productId),
    )
    .first();
  const nextQty = Math.min(
    MAX_LINE_QTY,
    mode === "add" ? (existing?.quantity ?? 0) + quantity : quantity,
  );
  await loadOrderableProduct(
    ctx,
    productId,
    nextQty,
    mode === "add" ? (existing?.quantity ?? 0) : 0,
  );
  if (existing) {
    await ctx.db.patch("cartItems", existing._id, { quantity: nextQty });
  } else {
    const count = (await cartItems(ctx, cart._id)).length;
    if (count >= MAX_CART_LINES) invalid("Korpa može imati najviše 100 stavki.");
    await ctx.db.insert("cartItems", {
      cartId: cart._id,
      productId,
      quantity: nextQty,
      source,
      addedAt: Date.now(),
    });
  }
}

async function touch(ctx: MutationCtx, cart: Doc<"carts">): Promise<void> {
  await ctx.db.patch("carts", cart._id, { updatedAt: Date.now() });
}

async function writableCart(
  ctx: MutationCtx & { viewer: Viewer | null; client: ClientInfo },
  guestToken: string | undefined,
  create: boolean,
): Promise<Doc<"carts"> | null> {
  let cart = await findCart(ctx, ctx.viewer, guestToken);
  if (!cart && create) {
    // Every fresh guest token would otherwise mint a new cart row without limit.
    if (!ctx.viewer) await enforceRateLimit(ctx, "cartCreate", ctx.client.key);
    cart = await getOrCreateCart(ctx, ctx.viewer, guestToken);
  }
  if (cart) await enforceRateLimit(ctx, "cartWrite", cart._id);
  return cart;
}

export const addItem = publicMutation({
  args: {
    guestToken: v.optional(v.string()),
    productId: v.id("products"),
    quantity: v.number(),
    source: v.optional(cartItemSourceV),
  },
  returns: v.id("carts"),
  handler: async (ctx, args) => {
    assertQuantity(args.quantity);
    const cart = (await writableCart(ctx, args.guestToken, true))!;
    await upsertLine(ctx, cart, args.productId, args.quantity, args.source ?? "catalog", "add");
    await touch(ctx, cart);
    return cart._id;
  },
});

export const setQuantity = publicMutation({
  args: { guestToken: v.optional(v.string()), productId: v.id("products"), quantity: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertQuantity(args.quantity);
    const cart = await writableCart(ctx, args.guestToken, false);
    if (!cart) return notFound("Korpa nije pronađena.");
    await upsertLine(ctx, cart, args.productId, args.quantity, "catalog", "set");
    await touch(ctx, cart);
    return null;
  },
});

export const removeItem = publicMutation({
  args: { guestToken: v.optional(v.string()), productId: v.id("products") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cart = await writableCart(ctx, args.guestToken, false);
    if (!cart) return null;
    const line = await ctx.db
      .query("cartItems")
      .withIndex("by_cartId_and_productId", (q) =>
        q.eq("cartId", cart._id).eq("productId", args.productId),
      )
      .first();
    if (line) await ctx.db.delete("cartItems", line._id);
    await touch(ctx, cart);
    return null;
  },
});

export const clear = publicMutation({
  args: { guestToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cart = await writableCart(ctx, args.guestToken, false);
    if (!cart) return null;
    for (const line of await cartItems(ctx, cart._id)) await ctx.db.delete("cartItems", line._id);
    await touch(ctx, cart);
    return null;
  },
});

/** Quick order / reorder: adds several lines; unavailable ones are reported, not thrown. */
export const addMany = publicMutation({
  args: {
    guestToken: v.optional(v.string()),
    items: v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
    source: cartItemSourceV,
  },
  returns: v.object({
    added: v.array(v.id("products")),
    rejected: v.array(v.object({ productId: v.id("products"), reason: v.string() })),
  }),
  handler: async (ctx, args) => {
    if (args.items.length > MAX_CART_LINES) invalid("Najviše 100 stavki odjednom.");
    const cart = (await writableCart(ctx, args.guestToken, true))!;
    const added: Id<"products">[] = [];
    const rejected: { productId: Id<"products">; reason: string }[] = [];
    for (const item of args.items) {
      try {
        assertQuantity(item.quantity);
        await upsertLine(ctx, cart, item.productId, item.quantity, args.source, "add");
        added.push(item.productId);
      } catch (error) {
        const data = (error as { data?: { message?: string } }).data;
        rejected.push({
          productId: item.productId,
          reason: data?.message ?? "Artikal nije dodat.",
        });
      }
    }
    await touch(ctx, cart);
    return { added, rejected };
  },
});

/** After sign-in: moves the guest cart into the user's cart (quantities summed, capped). */
export const mergeGuest = userMutation({
  args: { guestToken: v.string() },
  returns: v.object({ merged: v.number() }),
  handler: async (ctx, { guestToken }) => {
    if (!isTokenShape(guestToken)) return { merged: 0 };
    const hash = await hashToken(guestToken);
    const guest = await ctx.db
      .query("carts")
      .withIndex("by_guestTokenHash", (q) => q.eq("guestTokenHash", hash))
      .first();
    if (!guest || guest.status !== "active" || guest.ownerType !== "guest") return { merged: 0 };
    const target = await getOrCreateCart(ctx, ctx.viewer, undefined);
    let merged = 0;
    for (const line of await cartItems(ctx, guest._id)) {
      const product = await ctx.db.get("products", line.productId);
      if (product && isListed(product)) {
        const existing = await ctx.db
          .query("cartItems")
          .withIndex("by_cartId_and_productId", (q) =>
            q.eq("cartId", target._id).eq("productId", line.productId),
          )
          .first();
        let qty = Math.min(MAX_LINE_QTY, (existing?.quantity ?? 0) + line.quantity);
        const check = canOrderQuantity(product, qty);
        if (!check.ok) qty = Math.max(existing?.quantity ?? 0, check.available);
        if (qty > 0) {
          if (existing) await ctx.db.patch("cartItems", existing._id, { quantity: qty });
          else
            await ctx.db.insert("cartItems", {
              cartId: target._id,
              productId: line.productId,
              quantity: qty,
              source: line.source,
              addedAt: line.addedAt,
            });
          merged++;
        }
      }
      await ctx.db.delete("cartItems", line._id);
    }
    await ctx.db.patch("carts", guest._id, { status: "merged", updatedAt: Date.now() });
    await touch(ctx, target);
    return { merged };
  },
});
