/**
 * Customer-side orders (docs/ARCHITECTURE.md §A1, §E2): submit from the cart with
 * server-side re-pricing and validation, tokenized status page, own order history, reorder.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { canOrderQuantity } from "../lib/domain/stock";
import { actorOf } from "./lib/authz";
import { cartItems, findCart, getOrCreateCart, MAX_LINE_QTY, priceLines } from "./lib/carts";
import { isListed } from "./lib/catalog";
import { fail, invalid, notFound } from "./lib/errors";
import { publicMutation, publicQuery, userMutation, userQuery } from "./lib/functions";
import { createOrder, validateCheckout, type NewOrderLine } from "./lib/orders";
import { creditStatus, formatDinarsSr } from "./lib/mechanics";
import { enforceRateLimit } from "./lib/rateLimits";
import { resolveEmailConfig } from "./lib/emailConfig";
import { getSettings } from "./lib/settings";
import { hashToken, isTokenShape } from "./lib/tokens";
import {
  addressV,
  attributionV,
  companyV,
  consentV,
  contactV,
  deliveryMethodV,
  orderStatusV,
  paymentMethodV,
  qualityV,
  stockStateV,
  vehicleSnapshotV,
} from "./lib/validators";

const MIN_FORM_MS = 3_000;

export const submit = publicMutation({
  args: {
    guestToken: v.optional(v.string()),
    contact: contactV,
    company: v.optional(companyV),
    delivery: v.object({ method: deliveryMethodV, address: v.optional(addressV) }),
    payment: v.object({ method: paymentMethodV }),
    vehicle: v.optional(vehicleSnapshotV),
    note: v.optional(v.string()),
    consent: consentV,
    attribution: v.optional(attributionV),
    eventSourceUrl: v.optional(v.string()),
    /** Total the customer reviewed; a mismatch means prices/stock changed meanwhile. */
    expectedTotalPara: v.optional(v.number()),
    honeypot: v.string(),
    startedAt: v.number(),
  },
  returns: v.object({ number: v.string(), token: v.string(), totalPara: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.honeypot.trim() !== "")
      fail("SPAM", "Porudžbina nije poslata. Pozovite nas telefonom.");
    if (now - args.startedAt < MIN_FORM_MS) fail("SPAM", "Pokušajte ponovo za nekoliko sekundi.");
    await enforceRateLimit(ctx, "orderSubmitGlobal", "global");
    await enforceRateLimit(ctx, "orderSubmit", ctx.client.key);

    const settings = await getSettings(ctx);
    const viewer = ctx.viewer;
    if (!viewer && !settings.flags.guestCheckout) {
      fail("UNAUTHENTICATED", "Prijavite se da biste poručili. Korpa ostaje sačuvana.");
    }
    const checkout = validateCheckout(args, settings, viewer);
    await enforceRateLimit(ctx, "orderSubmitEmail", checkout.contact.email);

    const cart = await findCart(ctx, viewer, args.guestToken);
    if (!cart) fail("EMPTY_CART", "Korpa je prazna.");
    const items = await cartItems(ctx, cart._id);
    if (items.length === 0) fail("EMPTY_CART", "Korpa je prazna.");
    const priced = await priceLines(ctx, viewer, items);

    const problems = priced.filter((l) => !l.orderable);
    if (problems.length > 0) {
      const first = problems[0];
      const message =
        first.notice?.kind === "insufficient_stock"
          ? `${first.product?.name ?? "Artikal"}: na stanju je još ${first.notice.available} kom.`
          : "Neki artikli više nisu dostupni. Proverite korpu.";
      fail("OUT_OF_STOCK", message, { productId: first.item.productId });
    }

    const lines: NewOrderLine[] = priced.map((l) => {
      const p = l.product!;
      return {
        productId: p._id,
        sku: p.sku,
        name: p.name,
        manufacturerName: p.manufacturerName,
        quality: p.quality,
        ...(p.oemPrimary ? { oem: p.oemPrimary } : {}),
        quantity: l.item.quantity,
        unitRetailPara: l.unitRetailPara,
        unitPricePara: l.unitPricePara,
        discountBp: l.discountBp,
        availabilityAtOrder: l.notice?.kind === "backorder" ? "on_order" : p.stockState,
        ...(p.leadTimeDays !== undefined ? { leadTimeDays: p.leadTimeDays } : {}),
        isCustomLine: false,
        categoryId: p.categoryId,
      };
    });

    if (args.expectedTotalPara !== undefined) {
      const itemsPara = lines.reduce((s, l) => s + l.unitPricePara * l.quantity, 0);
      const free = checkout.deliveryConfig.freeOverPara;
      const delivery =
        free !== undefined && itemsPara >= free ? 0 : checkout.deliveryConfig.pricePara;
      if (itemsPara + delivery !== args.expectedTotalPara) {
        fail(
          "PRICE_CHANGED",
          "Cene ili stanje su se promenili. Proverite korpu i potvrdite ponovo.",
          {
            totalPara: itemsPara + delivery,
          },
        );
      }
    }

    const isMechanic = viewer?.mechanic?.status === "approved";
    let tierSnapshot: { tierId: Id<"priceTiers">; name: string } | undefined;
    let paymentTermsDays: number | undefined;
    if (isMechanic && viewer?.mechanic) {
      const profile = await ctx.db.get("mechanicProfiles", viewer.mechanic.profileId);
      paymentTermsDays = profile?.paymentTermsDays;
      if (profile?.tierId) {
        const tier = await ctx.db.get("priceTiers", profile.tierId);
        if (tier) tierSnapshot = { tierId: tier._id, name: tier.name };
      }
      if (profile && checkout.payment.method === "deferred") {
        const credit = await creditStatus(ctx, profile);
        const itemsPara = lines.reduce((s, l) => s + l.unitPricePara * l.quantity, 0);
        const free = checkout.deliveryConfig.freeOverPara;
        const deliveryPara =
          free !== undefined && itemsPara >= free ? 0 : checkout.deliveryConfig.pricePara;
        if (credit.availablePara !== null && itemsPara + deliveryPara > credit.availablePara) {
          invalid(
            `Limit za odloženo plaćanje nije dovoljan: preostalo je ${formatDinarsSr(credit.availablePara)}. Izaberite drugi način plaćanja ili nas pozovite.`,
            "payment.method",
          );
        }
      }
    }

    const result = await createOrder(ctx, {
      checkout,
      lines,
      customerType: isMechanic ? "mechanic" : viewer ? "customer" : "guest",
      ...(viewer ? { userId: viewer.userId } : {}),
      ...(isMechanic && viewer?.mechanic ? { mechanicProfileId: viewer.mechanic.profileId } : {}),
      ...(tierSnapshot ? { tierSnapshot } : {}),
      ...(paymentTermsDays !== undefined ? { paymentTermsDays } : {}),
      ...(args.attribution ? { attribution: args.attribution } : {}),
      source: "web",
      isDemo: false,
      actor: viewer
        ? actorOf(viewer)
        : { type: "customer", name: `${checkout.contact.firstName} ${checkout.contact.lastName}` },
      ...(ctx.client.ip && ctx.client.userAgent
        ? {
            capiContext: {
              ip: ctx.client.ip,
              userAgent: ctx.client.userAgent,
              eventSourceUrl: (args.eventSourceUrl ?? "").slice(0, 500),
            },
          }
        : {}),
    });

    for (const item of items) await ctx.db.delete("cartItems", item._id);
    await ctx.db.patch("carts", cart._id, { status: "converted", updatedAt: now });
    const order = (await ctx.db.get("orders", result.orderId))!;
    return { number: result.number, token: result.token, totalPara: order.totals.totalPara };
  },
});

const orderViewV = v.object({
  number: v.string(),
  status: orderStatusV,
  createdAt: v.number(),
  updatedAt: v.number(),
  customerType: v.union(v.literal("guest"), v.literal("customer"), v.literal("mechanic")),
  contact: contactV,
  company: v.union(companyV, v.null()),
  delivery: v.object({
    method: deliveryMethodV,
    pricePara: v.number(),
    address: v.union(addressV, v.null()),
    courierName: v.union(v.string(), v.null()),
    trackingNumber: v.union(v.string(), v.null()),
    trackingUrl: v.union(v.string(), v.null()),
  }),
  payment: v.object({
    method: paymentMethodV,
    status: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
    reference: v.string(),
    dueAt: v.union(v.number(), v.null()),
  }),
  totals: v.object({
    itemsRetailPara: v.number(),
    discountPara: v.number(),
    itemsPara: v.number(),
    deliveryPara: v.number(),
    totalPara: v.number(),
    vatPara: v.number(),
    currency: v.literal("RSD"),
  }),
  items: v.array(
    v.object({
      sku: v.string(),
      name: v.string(),
      manufacturerName: v.string(),
      quality: v.union(qualityV, v.null()),
      oem: v.union(v.string(), v.null()),
      quantity: v.number(),
      unitRetailPara: v.number(),
      unitPricePara: v.number(),
      lineTotalPara: v.number(),
      availabilityAtOrder: stockStateV,
      leadTimeDays: v.union(v.number(), v.null()),
      productId: v.union(v.id("products"), v.null()),
    }),
  ),
  timeline: v.array(
    v.object({
      type: v.string(),
      toStatus: v.union(orderStatusV, v.null()),
      message: v.union(v.string(), v.null()),
      at: v.number(),
    }),
  ),
  vehicle: v.union(vehicleSnapshotV, v.null()),
  customerNote: v.union(v.string(), v.null()),
  cancelReason: v.union(v.string(), v.null()),
  hasBackorder: v.boolean(),
  /** True when status e-mails really go out (delivery mode test/live). */
  emailUpdates: v.boolean(),
});

async function orderView(ctx: QueryCtx, order: Doc<"orders">) {
  const settings = await getSettings(ctx);
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
    .take(200);
  const events = await ctx.db
    .query("orderEvents")
    .withIndex("by_orderId_and_at", (q) => q.eq("orderId", order._id))
    .take(200);
  const courier = order.delivery.courierCode
    ? settings.couriers.find((c) => c.code === order.delivery.courierCode)
    : undefined;
  return {
    number: order.number,
    status: order.status,
    createdAt: order._creationTime,
    updatedAt: order.updatedAt,
    customerType: order.customerType,
    contact: order.contact,
    company: order.company ?? null,
    delivery: {
      method: order.delivery.method,
      pricePara: order.delivery.pricePara,
      address: order.delivery.address ?? null,
      courierName: courier?.name ?? null,
      trackingNumber: order.delivery.trackingNumber ?? null,
      trackingUrl: order.delivery.trackingUrl ?? null,
    },
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      reference: order.payment.reference,
      dueAt: order.payment.dueAt ?? null,
    },
    totals: order.totals,
    items: items.map((i) => ({
      sku: i.sku,
      name: i.name,
      manufacturerName: i.manufacturerName,
      quality: i.quality ?? null,
      oem: i.oem ?? null,
      quantity: i.quantity,
      unitRetailPara: i.unitRetailPara,
      unitPricePara: i.unitPricePara,
      lineTotalPara: i.lineTotalPara,
      availabilityAtOrder: i.availabilityAtOrder,
      leadTimeDays: i.leadTimeDays ?? null,
      productId: i.productId ?? null,
    })),
    timeline: events
      .filter((e) => e.visibleToCustomer)
      .map((e) => ({
        type: e.type,
        toStatus: e.toStatus ?? null,
        message: e.message ?? null,
        at: e.at,
      })),
    vehicle: order.vehicle ?? null,
    customerNote: order.customerNote ?? null,
    cancelReason: order.cancelReason ?? null,
    hasBackorder: order.hasBackorder,
    emailUpdates:
      resolveEmailConfig(settings).effective !== "log" && !order.isDemo && !order.isTest,
  };
}

/** Status page `/porudzbina/<token>` — the token is the capability. */
export const getByToken = publicQuery({
  args: { token: v.string() },
  returns: v.union(v.null(), orderViewV),
  handler: async (ctx, { token }) => {
    if (!isTokenShape(token)) return null;
    const tokenHash = await hashToken(token);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_publicTokenHash", (q) => q.eq("publicTokenHash", tokenHash))
      .unique();
    return order ? await orderView(ctx, order) : null;
  },
});

export const myOrders = userQuery({
  args: {},
  returns: v.array(
    v.object({
      number: v.string(),
      status: orderStatusV,
      createdAt: v.number(),
      totalPara: v.number(),
      itemCount: v.number(),
      paymentMethod: paymentMethodV,
      paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
      dueAt: v.union(v.number(), v.null()),
      deliveryMethod: deliveryMethodV,
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .order("desc")
      .take(100);
    return rows.map((o) => ({
      number: o.number,
      status: o.status,
      createdAt: o._creationTime,
      totalPara: o.totals.totalPara,
      itemCount: o.itemCount,
      paymentMethod: o.payment.method,
      paymentStatus: o.payment.status,
      dueAt: o.payment.dueAt ?? null,
      deliveryMethod: o.delivery.method,
    }));
  },
});

async function ownOrder(
  ctx: QueryCtx,
  userId: Id<"users">,
  number: string,
): Promise<Doc<"orders"> | null> {
  const order = await ctx.db
    .query("orders")
    .withIndex("by_number", (q) => q.eq("number", number.slice(0, 40)))
    .unique();
  return order && order.userId === userId ? order : null;
}

export const myOrder = userQuery({
  args: { number: v.string() },
  returns: v.union(v.null(), orderViewV),
  handler: async (ctx, { number }) => {
    const order = await ownOrder(ctx, ctx.viewer.userId, number);
    return order ? await orderView(ctx, order) : null;
  },
});

/** „Poruči ponovo“: adds the still-available lines of an own order to the cart. */
export const reorder = userMutation({
  args: { number: v.string() },
  returns: v.object({
    added: v.number(),
    unavailable: v.array(v.object({ sku: v.string(), name: v.string() })),
  }),
  handler: async (ctx, { number }) => {
    const order = await ownOrder(ctx, ctx.viewer.userId, number);
    if (!order) return notFound("Porudžbina ne postoji.");
    const cart = await getOrCreateCart(ctx, ctx.viewer, undefined);
    await enforceRateLimit(ctx, "cartWrite", cart._id);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .take(200);
    let added = 0;
    const unavailable: { sku: string; name: string }[] = [];
    for (const item of items) {
      const product = item.productId ? await ctx.db.get("products", item.productId) : null;
      if (!product || !isListed(product) || !canOrderQuantity(product, item.quantity).ok) {
        unavailable.push({ sku: item.sku, name: item.name });
        continue;
      }
      const existing = await ctx.db
        .query("cartItems")
        .withIndex("by_cartId_and_productId", (q) =>
          q.eq("cartId", cart._id).eq("productId", product._id),
        )
        .first();
      const quantity = Math.min(MAX_LINE_QTY, (existing?.quantity ?? 0) + item.quantity);
      if (existing) await ctx.db.patch("cartItems", existing._id, { quantity });
      else
        await ctx.db.insert("cartItems", {
          cartId: cart._id,
          productId: product._id,
          quantity,
          source: "reorder",
          addedAt: Date.now(),
        });
      added++;
    }
    await ctx.db.patch("carts", cart._id, { updatedAt: Date.now() });
    return { added, unavailable };
  },
});
