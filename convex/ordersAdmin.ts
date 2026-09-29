/**
 * Staff order management (docs/ARCHITECTURE.md §A5, §E2). Every write is audited; status
 * changes go through the pure state machine with an `expectedUpdatedAt` precondition.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { computeOrderTotals } from "../lib/domain/orderTotals";
import { orderItemsEditable } from "../lib/domain/orderStateMachine";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { staffMutation, staffQuery } from "./lib/functions";
import { transitionOrder } from "./lib/orders";
import { getSettings } from "./lib/settings";
import { actorV, attributionV, orderStatusV } from "./lib/validators";

const listRowV = v.object({
  _id: v.id("orders"),
  number: v.string(),
  status: orderStatusV,
  customerType: v.union(v.literal("guest"), v.literal("customer"), v.literal("mechanic")),
  customerName: v.string(),
  companyName: v.union(v.string(), v.null()),
  totalPara: v.number(),
  itemCount: v.number(),
  deliveryMethod: v.union(v.literal("pickup"), v.literal("courier")),
  paymentMethod: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  isDemo: v.boolean(),
});

export const list = staffQuery({
  args: {
    status: v.optional(orderStatusV),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listRowV),
  handler: async (ctx, { status, search, paginationOpts }) => {
    const term = search?.trim().slice(0, 100);
    const result = term
      ? await ctx.db
          .query("orders")
          .withSearchIndex("search_orders", (q) => {
            const base = q.search("searchText", term.toLowerCase());
            return status ? base.eq("status", status) : base;
          })
          .paginate(paginationOpts)
      : status
        ? await ctx.db
            .query("orders")
            .withIndex("by_status", (q) => q.eq("status", status))
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("orders")
            .withIndex("by_updatedAt")
            .order("desc")
            .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((o) => ({
        _id: o._id,
        number: o.number,
        status: o.status,
        customerType: o.customerType,
        customerName: `${o.contact.firstName} ${o.contact.lastName}`,
        companyName: o.company?.name ?? null,
        totalPara: o.totals.totalPara,
        itemCount: o.itemCount,
        deliveryMethod: o.delivery.method,
        paymentMethod: o.payment.method,
        createdAt: o._creationTime,
        updatedAt: o.updatedAt,
        isDemo: o.isDemo,
      })),
    };
  },
});

export const get = staffQuery({
  args: { number: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      order: v.object({
        _id: v.id("orders"),
        number: v.string(),
        status: orderStatusV,
        updatedAt: v.number(),
        createdAt: v.number(),
        customerType: v.string(),
        contact: v.object({
          firstName: v.string(),
          lastName: v.string(),
          email: v.string(),
          phone: v.string(),
        }),
        companyName: v.union(v.string(), v.null()),
        companyPib: v.union(v.string(), v.null()),
        deliveryMethod: v.string(),
        trackingNumber: v.union(v.string(), v.null()),
        paymentMethod: v.string(),
        paymentStatus: v.string(),
        totalPara: v.number(),
        itemsPara: v.number(),
        deliveryPara: v.number(),
        discountPara: v.number(),
        tierName: v.union(v.string(), v.null()),
        attribution: v.union(attributionV, v.null()),
        customerNote: v.union(v.string(), v.null()),
        cancelReason: v.union(v.string(), v.null()),
        stockCommitted: v.boolean(),
        isDemo: v.boolean(),
      }),
      items: v.array(
        v.object({
          _id: v.id("orderItems"),
          productId: v.union(v.id("products"), v.null()),
          sku: v.string(),
          name: v.string(),
          manufacturerName: v.string(),
          quantity: v.number(),
          unitRetailPara: v.number(),
          unitPricePara: v.number(),
          discountBp: v.number(),
          lineTotalPara: v.number(),
          availabilityAtOrder: v.string(),
          committedQty: v.union(v.number(), v.null()),
          currentStock: v.union(v.number(), v.null()),
        }),
      ),
      events: v.array(
        v.object({
          type: v.string(),
          fromStatus: v.union(orderStatusV, v.null()),
          toStatus: v.union(orderStatusV, v.null()),
          message: v.union(v.string(), v.null()),
          visibleToCustomer: v.boolean(),
          actor: actorV,
          at: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { number }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!order) return null;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .take(200);
    const events = await ctx.db
      .query("orderEvents")
      .withIndex("by_orderId_and_at", (q) => q.eq("orderId", order._id))
      .take(300);
    const itemRows = [];
    for (const i of items) {
      const product = i.productId ? await ctx.db.get("products", i.productId) : null;
      itemRows.push({
        _id: i._id,
        productId: i.productId ?? null,
        sku: i.sku,
        name: i.name,
        manufacturerName: i.manufacturerName,
        quantity: i.quantity,
        unitRetailPara: i.unitRetailPara,
        unitPricePara: i.unitPricePara,
        discountBp: i.discountBp,
        lineTotalPara: i.lineTotalPara,
        availabilityAtOrder: i.availabilityAtOrder,
        committedQty: i.committedQty ?? null,
        currentStock: product?.stockQty ?? null,
      });
    }
    return {
      order: {
        _id: order._id,
        number: order.number,
        status: order.status,
        updatedAt: order.updatedAt,
        createdAt: order._creationTime,
        customerType: order.customerType,
        contact: order.contact,
        companyName: order.company?.name ?? null,
        companyPib: order.company?.pib ?? null,
        deliveryMethod: order.delivery.method,
        trackingNumber: order.delivery.trackingNumber ?? null,
        paymentMethod: order.payment.method,
        paymentStatus: order.payment.status,
        totalPara: order.totals.totalPara,
        itemsPara: order.totals.itemsPara,
        deliveryPara: order.totals.deliveryPara,
        discountPara: order.totals.discountPara,
        tierName: order.tierSnapshot?.name ?? null,
        attribution: order.attribution ?? null,
        customerNote: order.customerNote ?? null,
        cancelReason: order.cancelReason ?? null,
        stockCommitted: order.stockCommitted,
        isDemo: order.isDemo,
      },
      items: itemRows,
      events: events.map((e) => ({
        type: e.type,
        fromStatus: e.fromStatus ?? null,
        toStatus: e.toStatus ?? null,
        message: e.message ?? null,
        visibleToCustomer: e.visibleToCustomer,
        actor: e.actor,
        at: e.at,
      })),
    };
  },
});

export const transition = staffMutation({
  args: {
    orderId: v.id("orders"),
    to: orderStatusV,
    reason: v.optional(v.string()),
    tracking: v.optional(v.object({ courierCode: v.string(), trackingNumber: v.string() })),
    expectedUpdatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.tracking) {
      const settings = await getSettings(ctx);
      if (!settings.couriers.some((c) => c.code === args.tracking!.courierCode)) {
        invalid("Nepoznata kurirska služba.", "tracking.courierCode");
      }
      if (!args.tracking.trackingNumber.trim())
        invalid("Upišite broj pošiljke.", "tracking.trackingNumber");
    }
    await transitionOrder(ctx, args.orderId, args.to, {
      actor: actorOf(ctx.viewer),
      ...(args.reason ? { reason: args.reason } : {}),
      ...(args.tracking ? { tracking: args.tracking } : {}),
      expectedUpdatedAt: args.expectedUpdatedAt,
      auditAsStaff: true,
    });
    return null;
  },
});

export const addNote = staffMutation({
  args: { orderId: v.id("orders"), message: v.string(), visibleToCustomer: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { orderId, message, visibleToCustomer }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return notFound("Porudžbina ne postoji.");
    const text = message.trim().slice(0, 1_000);
    if (!text) invalid("Napomena je prazna.", "message");
    const actor = actorOf(ctx.viewer);
    const now = Date.now();
    await ctx.db.insert("orderEvents", {
      orderId,
      type: "note",
      message: text,
      visibleToCustomer,
      actor,
      at: now,
    });
    await ctx.db.patch("orders", orderId, { lastStaffActionAt: now });
    await audit(ctx, {
      actor,
      action: "order.note",
      entityType: "order",
      entityId: orderId,
      summary: `${order.number}: napomena`,
    });
    return null;
  },
});

export const markPaid = staffMutation({
  args: { orderId: v.id("orders"), paid: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { orderId, paid }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return notFound("Porudžbina ne postoji.");
    const status = paid ? "paid" : "unpaid";
    if (order.payment.status === status) return null;
    const now = Date.now();
    const actor = actorOf(ctx.viewer);
    await ctx.db.patch("orders", orderId, {
      payment: { ...order.payment, status, ...(paid ? { paidAt: now } : { paidAt: undefined }) },
      updatedAt: now,
      lastStaffActionAt: now,
    });
    await ctx.db.insert("orderEvents", {
      orderId,
      type: "payment_marked",
      message: paid ? "Uplata je evidentirana." : "Uplata je poništena.",
      visibleToCustomer: paid,
      actor,
      at: now,
    });
    await audit(ctx, {
      actor,
      action: "order.payment",
      entityType: "order",
      entityId: orderId,
      summary: `${order.number}: ${paid ? "plaćeno" : "nije plaćeno"}`,
      diff: [{ field: "payment.status", before: order.payment.status, after: status }],
    });
    return null;
  },
});

export const setTracking = staffMutation({
  args: {
    orderId: v.id("orders"),
    courierCode: v.string(),
    trackingNumber: v.string(),
    expectedUpdatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("orders", args.orderId);
    if (!order) return notFound("Porudžbina ne postoji.");
    if (order.updatedAt !== args.expectedUpdatedAt)
      fail("CONFLICT", "Porudžbina je u međuvremenu izmenjena — osvežite.");
    if (order.delivery.method !== "courier") invalid("Broj pošiljke važi samo za dostavu kurirom.");
    const settings = await getSettings(ctx);
    const courier = settings.couriers.find((c) => c.code === args.courierCode);
    if (!courier) invalid("Nepoznata kurirska služba.", "courierCode");
    const trackingNumber = args.trackingNumber.trim().slice(0, 60);
    if (!trackingNumber) invalid("Upišite broj pošiljke.", "trackingNumber");
    const now = Date.now();
    const actor = actorOf(ctx.viewer);
    await ctx.db.patch("orders", args.orderId, {
      delivery: {
        ...order.delivery,
        courierCode: courier.code,
        trackingNumber,
        trackingUrl: courier.trackingUrlTemplate
          ? courier.trackingUrlTemplate.replace("{broj}", encodeURIComponent(trackingNumber))
          : undefined,
      },
      updatedAt: now,
      lastStaffActionAt: now,
    });
    await ctx.db.insert("orderEvents", {
      orderId: args.orderId,
      type: "tracking_set",
      message: `${courier.name}: ${trackingNumber}`,
      visibleToCustomer: true,
      actor,
      at: now,
    });
    await audit(ctx, {
      actor,
      action: "order.tracking",
      entityType: "order",
      entityId: args.orderId,
      summary: `${order.number}: broj pošiljke ${trackingNumber}`,
    });
    return null;
  },
});

/** Edit quantities / unit prices / remove lines while the order is still `nova`. */
export const editItems = staffMutation({
  args: {
    orderId: v.id("orders"),
    expectedUpdatedAt: v.number(),
    changes: v.array(
      v.object({
        itemId: v.id("orderItems"),
        quantity: v.optional(v.number()),
        unitPricePara: v.optional(v.number()),
        remove: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("orders", args.orderId);
    if (!order) return notFound("Porudžbina ne postoji.");
    if (order.updatedAt !== args.expectedUpdatedAt)
      fail("CONFLICT", "Porudžbina je u međuvremenu izmenjena — osvežite.");
    if (!orderItemsEditable(order.status))
      invalid("Stavke se menjaju samo dok je porudžbina nova.");
    const diff = [];
    for (const change of args.changes.slice(0, 200)) {
      const item = await ctx.db.get("orderItems", change.itemId);
      if (!item || item.orderId !== order._id) return notFound("Stavka ne pripada porudžbini.");
      if (change.remove) {
        await ctx.db.delete("orderItems", item._id);
        diff.push({ field: item.sku, before: String(item.quantity), after: "0" });
        continue;
      }
      const quantity = change.quantity ?? item.quantity;
      const unitPricePara = change.unitPricePara ?? item.unitPricePara;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
        invalid("Količina 1–999.", "quantity");
      if (!Number.isInteger(unitPricePara) || unitPricePara < 0)
        invalid("Neispravna cena.", "unitPricePara");
      const discountBp =
        item.unitRetailPara > 0
          ? Math.max(
              0,
              Math.round(((item.unitRetailPara - unitPricePara) * 10_000) / item.unitRetailPara),
            )
          : 0;
      await ctx.db.patch("orderItems", item._id, {
        quantity,
        unitPricePara,
        discountBp,
        lineTotalPara: quantity * unitPricePara,
      });
      diff.push({
        field: item.sku,
        before: `${item.quantity} × ${item.unitPricePara}`,
        after: `${quantity} × ${unitPricePara}`,
      });
    }
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .take(200);
    if (items.length === 0)
      invalid("Porudžbina mora imati bar jednu stavku — otkažite je umesto toga.");
    const settings = await getSettings(ctx);
    const deliveryConfig = settings.deliveryMethods.find((d) => d.code === order.delivery.method);
    const totals = computeOrderTotals(
      items,
      {
        pricePara: deliveryConfig?.pricePara ?? order.delivery.pricePara,
        ...(deliveryConfig?.freeOverPara !== undefined
          ? { freeOverPara: deliveryConfig.freeOverPara }
          : {}),
      },
      settings.commerce.vatRateBp,
    );
    const now = Date.now();
    const actor = actorOf(ctx.viewer);
    await ctx.db.patch("orders", order._id, {
      totals,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      delivery: { ...order.delivery, pricePara: totals.deliveryPara },
      updatedAt: now,
      lastStaffActionAt: now,
    });
    await ctx.db.insert("orderEvents", {
      orderId: order._id,
      type: "edited",
      message: "Stavke porudžbine su izmenjene.",
      visibleToCustomer: true,
      actor,
      at: now,
    });
    await audit(ctx, {
      actor,
      action: "order.edit_items",
      entityType: "order",
      entityId: order._id,
      summary: `${order.number}: izmenjene stavke`,
      diff,
    });
    return null;
  },
});
