/**
 * Staff order management (docs/ARCHITECTURE.md §A5, §E2). Every write is audited; status
 * changes go through the pure state machine with an `expectedUpdatedAt` precondition and
 * emit `order.status_changed` (convex/lib/orders.ts#transitionOrder).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { computeOrderTotals } from "../lib/domain/orderTotals";
import { orderItemsEditable } from "../lib/domain/orderStateMachine";
import { foldForSearch } from "../lib/domain/search";
import { normalizePhone } from "../lib/format/phone";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { emitEvent } from "./lib/events";
import { staffMutation, staffQuery } from "./lib/functions";
import { classifyAttribution } from "../lib/domain/attribution";
import { transitionOrder } from "./lib/orders";
import { pricingContextForProfile, resolveForContext, type CategoryPathCache } from "./lib/pricing";
import { getSettings } from "./lib/settings";
import {
  actorV,
  attributionV,
  deliveryMethodV,
  orderStatusV,
  paymentMethodV,
} from "./lib/validators";

const customerTypeV = v.union(v.literal("guest"), v.literal("customer"), v.literal("mechanic"));
const orderSourceV = v.union(
  v.literal("web"),
  v.literal("inquiry"),
  v.literal("admin"),
  v.literal("quick_order"),
  v.literal("reorder"),
);

const listRowV = v.object({
  _id: v.id("orders"),
  number: v.string(),
  status: orderStatusV,
  customerType: customerTypeV,
  customerName: v.string(),
  companyName: v.union(v.string(), v.null()),
  phone: v.string(),
  totalPara: v.number(),
  itemCount: v.number(),
  deliveryMethod: deliveryMethodV,
  paymentMethod: paymentMethodV,
  paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
  trackingNumber: v.union(v.string(), v.null()),
  source: orderSourceV,
  campaign: v.union(v.string(), v.null()),
  channel: v.union(v.string(), v.null()),
  hasBackorder: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  isDemo: v.boolean(),
});

/** Campaign label (utm_campaign, last touch then first) and channel (click id / source). */
function campaignOf(a: Doc<"orders">["attribution"]): {
  campaign: string | null;
  channel: string | null;
} {
  const touch = a?.last ?? a?.first;
  if (!touch) return { campaign: null, channel: null };
  return { campaign: touch.campaign ?? null, channel: classifyAttribution(a).channel };
}

function toListRow(o: Doc<"orders">) {
  const { campaign, channel } = campaignOf(o.attribution);
  return {
    _id: o._id,
    number: o.number,
    status: o.status,
    customerType: o.customerType,
    customerName: `${o.contact.firstName} ${o.contact.lastName}`,
    companyName: o.company?.name ?? null,
    phone: o.contact.phone,
    totalPara: o.totals.totalPara,
    itemCount: o.itemCount,
    deliveryMethod: o.delivery.method,
    paymentMethod: o.payment.method,
    paymentStatus: o.payment.status,
    trackingNumber: o.delivery.trackingNumber ?? null,
    source: o.source,
    campaign,
    channel,
    hasBackorder: o.hasBackorder,
    createdAt: o._creationTime,
    updatedAt: o.updatedAt,
    isDemo: o.isDemo,
  };
}

/**
 * Orders list. The primary access path is an index (status + creation-time range, or the
 * search index); delivery / payment / customer type / source / campaign are post-filters
 * over that bounded, paginated range (D137), so every combination works without an index
 * per combination.
 */
export const list = staffQuery({
  args: {
    status: v.optional(orderStatusV),
    search: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    delivery: v.optional(deliveryMethodV),
    payment: v.optional(paymentMethodV),
    customerType: v.optional(customerTypeV),
    source: v.optional(orderSourceV),
    /** utm_campaign value, or `google_ads` / `meta_ads` for click-id traffic. */
    campaign: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listRowV),
  handler: async (ctx, args) => {
    const term = args.search?.trim().slice(0, 100);
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const campaign = args.campaign?.trim().slice(0, 100);
    const base = term
      ? ctx.db.query("orders").withSearchIndex("search_orders", (q) => {
          const phone = normalizePhone(term);
          const text = phone ? phone.replace(/\D/g, "") : foldForSearch(term);
          const s = q.search("searchText", text);
          if (args.status && args.customerType)
            return s.eq("status", args.status).eq("customerType", args.customerType);
          if (args.status) return s.eq("status", args.status);
          if (args.customerType) return s.eq("customerType", args.customerType);
          return s;
        })
      : args.status
        ? ctx.db
            .query("orders")
            .withIndex("by_status", (q) =>
              q.eq("status", args.status!).gte("_creationTime", from).lte("_creationTime", to),
            )
            .order("desc")
        : ctx.db
            .query("orders")
            .withIndex("by_creation_time", (q) =>
              q.gte("_creationTime", from).lte("_creationTime", to),
            )
            .order("desc");
    const dated = Boolean(term) && (args.from !== undefined || args.to !== undefined);
    const typeFilter = !term && args.customerType;
    const needsFilter =
      dated || args.delivery || args.payment || typeFilter || args.source || campaign;
    const query = needsFilter
      ? base.filter((q) =>
          q.and(
            dated ? q.gte(q.field("_creationTime"), from) : true,
            dated ? q.lte(q.field("_creationTime"), to) : true,
            args.delivery ? q.eq(q.field("delivery.method"), args.delivery) : true,
            args.payment ? q.eq(q.field("payment.method"), args.payment) : true,
            typeFilter ? q.eq(q.field("customerType"), args.customerType) : true,
            args.source ? q.eq(q.field("source"), args.source) : true,
            campaign === "google_ads"
              ? q.or(
                  q.neq(q.field("attribution.last.gclid"), undefined),
                  q.neq(q.field("attribution.last.gbraid"), undefined),
                  q.neq(q.field("attribution.last.wbraid"), undefined),
                )
              : campaign === "meta_ads"
                ? q.neq(q.field("attribution.last.fbclid"), undefined)
                : campaign
                  ? q.or(
                      q.eq(q.field("attribution.last.campaign"), campaign),
                      q.eq(q.field("attribution.first.campaign"), campaign),
                    )
                  : true,
          ),
        )
      : base;
    const result = await query.paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toListRow) };
  },
});

/** Counts for the status tabs: open statuses only (bounded at 500 each). */
export const statusCounts = staffQuery({
  args: {},
  returns: v.object({
    nova: v.number(),
    potvrdjena: v.number(),
    ceka_deo: v.number(),
    spremna_za_preuzimanje: v.number(),
    poslata: v.number(),
  }),
  handler: async (ctx) => {
    const count = async (status: Doc<"orders">["status"]) =>
      (
        await ctx.db
          .query("orders")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(500)
      ).length;
    return {
      nova: await count("nova"),
      potvrdjena: await count("potvrdjena"),
      ceka_deo: await count("ceka_deo"),
      spremna_za_preuzimanje: await count("spremna_za_preuzimanje"),
      poslata: await count("poslata"),
    };
  },
});

const addressOutV = v.object({
  street: v.string(),
  city: v.string(),
  postalCode: v.string(),
  note: v.union(v.string(), v.null()),
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
        customerType: customerTypeV,
        userId: v.union(v.id("users"), v.null()),
        mechanicProfileId: v.union(v.id("mechanicProfiles"), v.null()),
        contact: v.object({
          firstName: v.string(),
          lastName: v.string(),
          email: v.string(),
          phone: v.string(),
        }),
        company: v.union(
          v.null(),
          v.object({
            name: v.string(),
            pib: v.string(),
            mb: v.union(v.string(), v.null()),
            address: v.union(addressOutV, v.null()),
          }),
        ),
        deliveryMethod: deliveryMethodV,
        deliveryAddress: v.union(addressOutV, v.null()),
        courierCode: v.union(v.string(), v.null()),
        trackingNumber: v.union(v.string(), v.null()),
        trackingUrl: v.union(v.string(), v.null()),
        paymentMethod: paymentMethodV,
        paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
        paymentReference: v.string(),
        paidAt: v.union(v.number(), v.null()),
        dueAt: v.union(v.number(), v.null()),
        totalPara: v.number(),
        itemsPara: v.number(),
        itemsRetailPara: v.number(),
        deliveryPara: v.number(),
        discountPara: v.number(),
        vatPara: v.number(),
        tierName: v.union(v.string(), v.null()),
        attribution: v.union(attributionV, v.null()),
        customerNote: v.union(v.string(), v.null()),
        vehicle: v.union(v.string(), v.null()),
        vin: v.union(v.string(), v.null()),
        source: orderSourceV,
        inquiryNumber: v.union(v.string(), v.null()),
        cancelReason: v.union(v.string(), v.null()),
        stockCommitted: v.boolean(),
        hasBackorder: v.boolean(),
        isDemo: v.boolean(),
      }),
      items: v.array(
        v.object({
          _id: v.id("orderItems"),
          productId: v.union(v.id("products"), v.null()),
          sku: v.string(),
          name: v.string(),
          manufacturerName: v.string(),
          oem: v.union(v.string(), v.null()),
          quantity: v.number(),
          unitRetailPara: v.number(),
          unitPricePara: v.number(),
          discountBp: v.number(),
          lineTotalPara: v.number(),
          availabilityAtOrder: v.string(),
          leadTimeDays: v.union(v.number(), v.null()),
          isCustomLine: v.boolean(),
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
      emails: v.array(
        v.object({
          _id: v.id("emailLog"),
          subject: v.string(),
          to: v.array(v.string()),
          status: v.string(),
          mode: v.string(),
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
    const emails = await ctx.db
      .query("emailLog")
      .withIndex("by_relatedType_and_relatedId", (q) =>
        q.eq("relatedType", "order").eq("relatedId", order._id),
      )
      .order("desc")
      .take(30);
    const inquiry = order.inquiryId ? await ctx.db.get("inquiries", order.inquiryId) : null;
    const itemRows = [];
    for (const i of items) {
      const product = i.productId ? await ctx.db.get("products", i.productId) : null;
      itemRows.push({
        _id: i._id,
        productId: i.productId ?? null,
        sku: i.sku,
        name: i.name,
        manufacturerName: i.manufacturerName,
        oem: i.oem ?? null,
        quantity: i.quantity,
        unitRetailPara: i.unitRetailPara,
        unitPricePara: i.unitPricePara,
        discountBp: i.discountBp,
        lineTotalPara: i.lineTotalPara,
        availabilityAtOrder: i.availabilityAtOrder,
        leadTimeDays: i.leadTimeDays ?? null,
        isCustomLine: i.isCustomLine,
        committedQty: i.committedQty ?? null,
        currentStock: product?.stockQty ?? null,
      });
    }
    const addr = (a: Doc<"orders">["delivery"]["address"]) =>
      a ? { street: a.street, city: a.city, postalCode: a.postalCode, note: a.note ?? null } : null;
    const c = order.company;
    return {
      order: {
        _id: order._id,
        number: order.number,
        status: order.status,
        updatedAt: order.updatedAt,
        createdAt: order._creationTime,
        customerType: order.customerType,
        userId: order.userId ?? null,
        mechanicProfileId: order.mechanicProfileId ?? null,
        contact: order.contact,
        company: c
          ? { name: c.name, pib: c.pib, mb: c.mb ?? null, address: addr(c.address) }
          : null,
        deliveryMethod: order.delivery.method,
        deliveryAddress: addr(order.delivery.address),
        courierCode: order.delivery.courierCode ?? null,
        trackingNumber: order.delivery.trackingNumber ?? null,
        trackingUrl: order.delivery.trackingUrl ?? null,
        paymentMethod: order.payment.method,
        paymentStatus: order.payment.status,
        paymentReference: order.payment.reference,
        paidAt: order.payment.paidAt ?? null,
        dueAt: order.payment.dueAt ?? null,
        totalPara: order.totals.totalPara,
        itemsPara: order.totals.itemsPara,
        itemsRetailPara: order.totals.itemsRetailPara,
        deliveryPara: order.totals.deliveryPara,
        discountPara: order.totals.discountPara,
        vatPara: order.totals.vatPara,
        tierName: order.tierSnapshot?.name ?? null,
        attribution: order.attribution ?? null,
        customerNote: order.customerNote ?? null,
        vehicle: order.vehicle?.label ?? null,
        vin: order.vehicle?.vin ?? null,
        source: order.source,
        inquiryNumber: inquiry?.number ?? null,
        cancelReason: order.cancelReason ?? null,
        stockCommitted: order.stockCommitted,
        hasBackorder: order.hasBackorder,
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
      emails: emails.map((m) => ({
        _id: m._id,
        subject: m.subject,
        to: m.to,
        status: m.status,
        mode: m.mode,
        at: m._creationTime,
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

/**
 * Edit lines while the order is still `nova`: quantities, unit prices, removals and new
 * catalogue lines (priced for the order's mechanic when there is one, else retail).
 * Emits `order.edited` so the customer is told what changed.
 */
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
    add: v.optional(v.array(v.object({ productId: v.id("products"), quantity: v.number() }))),
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
      if (quantity === item.quantity && unitPricePara === item.unitPricePara) continue;
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
    const additions = (args.add ?? []).slice(0, 50);
    if (additions.length > 0) {
      const profile = order.mechanicProfileId
        ? await ctx.db.get("mechanicProfiles", order.mechanicProfileId)
        : null;
      const pc = profile ? await pricingContextForProfile(ctx, profile) : null;
      const cache: CategoryPathCache = new Map();
      const existing = await ctx.db
        .query("orderItems")
        .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
        .take(200);
      for (const line of additions) {
        if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999)
          invalid("Količina 1–999.", "quantity");
        const product = await ctx.db.get("products", line.productId);
        if (!product) return notFound("Artikal ne postoji.");
        const same = existing.find((i) => i.productId === product._id);
        if (same) {
          const quantity = Math.min(999, same.quantity + line.quantity);
          await ctx.db.patch("orderItems", same._id, {
            quantity,
            lineTotalPara: quantity * same.unitPricePara,
          });
          diff.push({ field: same.sku, before: String(same.quantity), after: String(quantity) });
          continue;
        }
        const resolved = pc ? await resolveForContext(ctx, pc, product, cache) : null;
        const unitPricePara = resolved?.unitPricePara ?? product.retailPricePara;
        const discountBp = resolved?.discountBp ?? 0;
        await ctx.db.insert("orderItems", {
          orderId: order._id,
          productId: product._id,
          sku: product.sku,
          name: product.name,
          manufacturerName: product.manufacturerName,
          quality: product.quality,
          ...(product.oemPrimary ? { oem: product.oemPrimary } : {}),
          quantity: line.quantity,
          unitRetailPara: product.retailPricePara,
          unitPricePara,
          discountBp,
          lineTotalPara: unitPricePara * line.quantity,
          availabilityAtOrder: product.stockState,
          ...(product.leadTimeDays !== undefined ? { leadTimeDays: product.leadTimeDays } : {}),
          isCustomLine: false,
        });
        diff.push({ field: product.sku, before: "0", after: String(line.quantity) });
      }
    }
    if (diff.length === 0) return null;
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
      hasBackorder: items.some(
        (i) => i.availabilityAtOrder === "on_order" || i.availabilityAtOrder === "out_of_stock",
      ),
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
    await emitEvent(ctx, {
      type: "order.edited",
      aggregateType: "order",
      aggregateId: order._id,
      payload: {
        kind: "order",
        orderId: order._id,
        number: order.number,
        totalPara: totals.totalPara,
      },
      dedupeKey: `order.edited:${order._id}:${now}`,
      actor,
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

/** Ids of orders on the same account / e-mail (customer history in the order detail). */
export const customerHistory = staffQuery({
  args: { orderId: v.id("orders") },
  returns: v.array(
    v.object({
      number: v.string(),
      status: orderStatusV,
      totalPara: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return [];
    const rows: Doc<"orders">[] = order.userId
      ? await ctx.db
          .query("orders")
          .withIndex("by_userId", (q) => q.eq("userId", order.userId))
          .order("desc")
          .take(11)
      : await ctx.db
          .query("orders")
          .withIndex("by_contact_email", (q) => q.eq("contact.email", order.contact.email))
          .order("desc")
          .take(11);
    return rows
      .filter((o) => o._id !== (orderId as Id<"orders">))
      .slice(0, 10)
      .map((o) => ({
        number: o.number,
        status: o.status,
        totalPara: o.totals.totalPara,
        createdAt: o._creationTime,
      }));
  },
});
