/**
 * Order creation and status transitions shared by `orders.submit`, quote acceptance,
 * `ordersAdmin.transition` and maintenance jobs (docs/DATA-MODEL.md §C6).
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizePhone } from "../../lib/format/phone";
import {
  formatDocumentNumber,
  isValidEmail,
  isValidMb,
  isValidPib,
  isValidPostalCode,
  normalizeEmail,
  normalizeMb,
  normalizePib,
  paymentReference,
} from "../../lib/domain/identifiers";
import { computeOrderTotals } from "../../lib/domain/orderTotals";
import {
  checkOrderTransition,
  commitsStockOn,
  ORDER_TRANSITION_ERRORS_SR,
  type OrderStatus,
} from "../../lib/domain/orderStateMachine";
import { buildSearchText } from "../../lib/domain/search";
import { belgradeYear } from "../../lib/domain/time";
import { normalizeVin, validateVin } from "../../lib/domain/vin";
import { audit } from "./audit";
import type { Viewer } from "./authz";
import { nextCounter } from "./counters";
import { fail, invalid } from "./errors";
import { emitEvent } from "./events";
import { applyStockDelta } from "./productWriter";
import type { Settings } from "./settingsSchema";
import { getSettings } from "./settings";
import { bumpStatsDaily } from "./stats";
import { hashToken, randomToken } from "./tokens";
import type {
  Actor,
  Address,
  Attribution,
  Company,
  Consent,
  Contact,
  DeliveryMethodCode,
  PaymentMethodCode,
  Quality,
  VehicleSnapshot,
} from "./validators";

export type NewOrderLine = {
  productId?: Id<"products">;
  sku: string;
  name: string;
  manufacturerName: string;
  quality?: Quality;
  oem?: string;
  quantity: number;
  unitRetailPara: number;
  unitPricePara: number;
  discountBp: number;
  availabilityAtOrder: Doc<"orderItems">["availabilityAtOrder"];
  leadTimeDays?: number;
  isCustomLine: boolean;
  note?: string;
  categoryId?: Id<"categories">;
};

export type CheckoutInput = {
  contact: Contact;
  company?: Company;
  delivery: { method: DeliveryMethodCode; address?: Address };
  payment: { method: PaymentMethodCode };
  vehicle?: VehicleSnapshot;
  note?: string;
  consent: Consent;
};

export type ValidatedCheckout = CheckoutInput & {
  deliveryConfig: Settings["deliveryMethods"][number];
};

const trimTo = (s: string, max: number) => s.trim().slice(0, max);

/** Server-side re-validation of everything the checkout form sends (never trust the client). */
export function validateCheckout(
  input: CheckoutInput,
  settings: Settings,
  viewer: Viewer | null,
): ValidatedCheckout {
  const firstName = trimTo(input.contact.firstName, 60);
  const lastName = trimTo(input.contact.lastName, 60);
  if (!firstName) invalid("Upišite ime.", "contact.firstName");
  if (!lastName) invalid("Upišite prezime.", "contact.lastName");
  const email = normalizeEmail(input.contact.email);
  if (!isValidEmail(email)) invalid("Upišite ispravnu e-mail adresu.", "contact.email");
  const phone = normalizePhone(input.contact.phone);
  if (!phone) invalid("Upišite ispravan broj telefona.", "contact.phone");

  let company: Company | undefined;
  if (input.company) {
    const name = trimTo(input.company.name, 120);
    const pib = normalizePib(input.company.pib);
    if (!name) invalid("Upišite naziv firme.", "company.name");
    if (!isValidPib(pib)) invalid("PIB nije ispravan (9 cifara, kontrolni broj).", "company.pib");
    const mb = input.company.mb ? normalizeMb(input.company.mb) : undefined;
    if (mb && !isValidMb(mb)) invalid("Matični broj nije ispravan (8 cifara).", "company.mb");
    company = {
      name,
      pib,
      ...(mb ? { mb } : {}),
      ...(input.company.address ? { address: input.company.address } : {}),
    };
  }

  const deliveryConfig = settings.deliveryMethods.find(
    (d) => d.code === input.delivery.method && d.active,
  );
  if (!deliveryConfig) invalid("Izabrani način dostave nije dostupan.", "delivery.method");
  let address: Address | undefined;
  if (input.delivery.method === "courier") {
    const a = input.delivery.address;
    if (!a || !a.street.trim() || !a.city.trim())
      invalid("Upišite adresu za dostavu.", "delivery.address");
    if (!isValidPostalCode(a.postalCode))
      invalid("Poštanski broj ima 5 cifara.", "delivery.address.postalCode");
    address = {
      street: trimTo(a.street, 120),
      city: trimTo(a.city, 60),
      postalCode: a.postalCode.trim(),
      ...(a.note ? { note: trimTo(a.note, 200) } : {}),
    };
  }

  const payment = settings.paymentMethods.find((p) => p.code === input.payment.method && p.active);
  if (!payment) invalid("Izabrani način plaćanja nije dostupan.", "payment.method");
  if (!payment.deliveryCodes.includes(input.delivery.method)) {
    invalid("Taj način plaćanja ne ide uz izabranu dostavu.", "payment.method");
  }
  if (payment.requires === "company" && !company)
    invalid("Plaćanje virmanom je za firme — upišite podatke firme.", "payment.method");
  if (payment.requires === "mechanic_credit") {
    const m = viewer?.mechanic;
    if (!m || m.status !== "approved" || !m.creditEnabled) {
      invalid(
        "Odloženo plaćanje je dostupno samo odobrenim majstorima sa tom opcijom.",
        "payment.method",
      );
    }
  }

  let vehicle: VehicleSnapshot | undefined;
  if (input.vehicle) {
    const vin = input.vehicle.vin ? normalizeVin(input.vehicle.vin) : undefined;
    if (vin && !validateVin(vin).valid) invalid("Broj šasije (VIN) nije ispravan.", "vehicle.vin");
    vehicle = {
      ...input.vehicle,
      label: trimTo(input.vehicle.label, 120),
      ...(vin ? { vin } : {}),
    };
  }
  const note = input.note ? trimTo(input.note, 1_000) : undefined;
  if (!input.consent.termsVersion || !input.consent.privacyVersion) {
    invalid("Potrebna je saglasnost sa uslovima kupovine.", "consent");
  }

  return {
    contact: { firstName, lastName, email, phone },
    ...(company ? { company } : {}),
    delivery: { method: input.delivery.method, ...(address ? { address } : {}) },
    payment: { method: input.payment.method },
    ...(vehicle ? { vehicle } : {}),
    ...(note ? { note } : {}),
    consent: input.consent,
    deliveryConfig,
  };
}

export type CreateOrderInput = {
  checkout: ValidatedCheckout;
  lines: NewOrderLine[];
  customerType: Doc<"orders">["customerType"];
  userId?: Id<"users">;
  mechanicProfileId?: Id<"mechanicProfiles">;
  tierSnapshot?: { tierId: Id<"priceTiers">; name: string };
  paymentTermsDays?: number;
  attribution?: Attribution;
  source: Doc<"orders">["source"];
  inquiryId?: Id<"inquiries">;
  quoteId?: Id<"quotes">;
  isDemo: boolean;
  isTest?: boolean;
  actor: Actor;
  capiContext?: { ip: string; userAgent: string; eventSourceUrl: string };
};

export async function createOrder(
  ctx: MutationCtx,
  input: CreateOrderInput,
): Promise<{ orderId: Id<"orders">; number: string; token: string }> {
  if (input.lines.length === 0) fail("EMPTY_CART", "Korpa je prazna.");
  const settings = await getSettings(ctx);
  const now = Date.now();
  const totals = computeOrderTotals(
    input.lines,
    {
      pricePara: input.checkout.deliveryConfig.pricePara,
      ...(input.checkout.deliveryConfig.freeOverPara !== undefined
        ? { freeOverPara: input.checkout.deliveryConfig.freeOverPara }
        : {}),
    },
    settings.commerce.vatRateBp,
  );
  const year = belgradeYear(now);
  const seq = await nextCounter(ctx, `order:${year}`);
  const number = formatDocumentNumber(settings.brand.orderPrefix, year, seq);
  const token = randomToken();
  const c = input.checkout;
  const itemCount = input.lines.reduce((sum, l) => sum + l.quantity, 0);
  const hasBackorder = input.lines.some(
    (l) => l.availabilityAtOrder === "on_order" || l.availabilityAtOrder === "out_of_stock",
  );

  const orderId = await ctx.db.insert("orders", {
    number,
    year,
    seq,
    publicTokenHash: await hashToken(token),
    status: "nova",
    customerType: input.customerType,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.mechanicProfileId ? { mechanicProfileId: input.mechanicProfileId } : {}),
    ...(input.tierSnapshot ? { tierSnapshot: input.tierSnapshot } : {}),
    contact: c.contact,
    ...(c.company ? { company: c.company } : {}),
    delivery: {
      method: c.delivery.method,
      pricePara: totals.deliveryPara,
      ...(c.delivery.address ? { address: c.delivery.address } : {}),
    },
    payment: {
      method: c.payment.method,
      status: "unpaid",
      reference: paymentReference(number),
      ...(c.payment.method === "deferred"
        ? { dueAt: now + (input.paymentTermsDays ?? 15) * 86_400_000 }
        : {}),
    },
    totals,
    itemCount,
    hasBackorder,
    ...(c.vehicle ? { vehicle: c.vehicle } : {}),
    ...(c.note ? { customerNote: c.note } : {}),
    consent: c.consent,
    ...(input.attribution ? { attribution: input.attribution } : {}),
    source: input.source,
    ...(input.inquiryId ? { inquiryId: input.inquiryId } : {}),
    ...(input.quoteId ? { quoteId: input.quoteId } : {}),
    stockCommitted: false,
    reminderLevel: 0,
    searchText: buildSearchText([
      number,
      `${c.contact.firstName} ${c.contact.lastName}`,
      c.contact.email,
      c.contact.phone,
      c.company?.name,
      c.company?.pib,
      ...input.lines.slice(0, 20).map((l) => l.sku),
    ]),
    isDemo: input.isDemo,
    ...(input.isTest ? { isTest: true } : {}),
    updatedAt: now,
  });

  const byCategory: Record<string, { count: number; valuePara: number }> = {};
  for (const line of input.lines) {
    await ctx.db.insert("orderItems", {
      orderId,
      ...(line.productId ? { productId: line.productId } : {}),
      sku: line.sku,
      name: line.name,
      manufacturerName: line.manufacturerName,
      ...(line.quality ? { quality: line.quality } : {}),
      ...(line.oem ? { oem: line.oem } : {}),
      quantity: line.quantity,
      unitRetailPara: line.unitRetailPara,
      unitPricePara: line.unitPricePara,
      discountBp: line.discountBp,
      lineTotalPara: line.unitPricePara * line.quantity,
      availabilityAtOrder: line.availabilityAtOrder,
      ...(line.leadTimeDays !== undefined ? { leadTimeDays: line.leadTimeDays } : {}),
      isCustomLine: line.isCustomLine,
      ...(line.note ? { note: line.note } : {}),
    });
    if (line.categoryId) {
      const entry = byCategory[line.categoryId] ?? { count: 0, valuePara: 0 };
      entry.count += line.quantity;
      entry.valuePara += line.unitPricePara * line.quantity;
      byCategory[line.categoryId] = entry;
    }
  }

  await ctx.db.insert("orderEvents", {
    orderId,
    type: "created",
    toStatus: "nova",
    message: "Porudžbina je primljena.",
    visibleToCustomer: true,
    actor: input.actor,
    at: now,
  });
  await emitEvent(ctx, {
    type: "order.created",
    aggregateType: "order",
    aggregateId: orderId,
    payload: {
      kind: "order",
      orderId,
      number,
      totalPara: totals.totalPara,
      customerType: input.customerType,
    },
    dedupeKey: `order.created:${orderId}`,
    actor: input.actor,
    ...(input.capiContext && input.attribution?.consentAds
      ? { capiContext: input.capiContext }
      : {}),
  });
  if (!input.isDemo && !input.isTest) {
    await bumpStatsDaily(ctx, now, {
      ordersCount: 1,
      ordersValuePara: totals.totalPara,
      byCategory,
    });
  }
  if (settings.commerce.stockDecrementOn === "created") {
    await commitStock(ctx, orderId, "order_created", input.actor);
  }
  return { orderId, number, token };
}

/** Takes the ordered quantities off the shelf (clamped at 0) and remembers what was taken. */
export async function commitStock(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  reason: "order_confirmed" | "order_created",
  actor: Actor,
): Promise<void> {
  const order = await ctx.db.get("orders", orderId);
  if (!order || order.stockCommitted) return;
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(200);
  for (const item of items) {
    if (!item.productId || item.isCustomLine) continue;
    const moved = await applyStockDelta(ctx, item.productId, -item.quantity, {
      reason,
      actor,
      refType: "order",
      refId: order.number,
    });
    await ctx.db.patch("orderItems", item._id, { committedQty: -moved });
  }
  await ctx.db.patch("orders", orderId, { stockCommitted: true });
}

/** Returns committed quantities to stock (cancel with `restockOnCancel`). */
export async function restock(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  actor: Actor,
): Promise<void> {
  const order = await ctx.db.get("orders", orderId);
  if (!order || !order.stockCommitted) return;
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(200);
  for (const item of items) {
    const qty = item.committedQty ?? 0;
    if (!item.productId || qty <= 0) continue;
    await applyStockDelta(ctx, item.productId, qty, {
      reason: "order_cancelled",
      actor,
      refType: "order",
      refId: order.number,
    });
    await ctx.db.patch("orderItems", item._id, { committedQty: 0 });
  }
  await ctx.db.patch("orders", orderId, { stockCommitted: false });
}

export type TransitionOptions = {
  actor: Actor;
  reason?: string;
  tracking?: { courierCode: string; trackingNumber: string };
  /** Optimistic concurrency: the `updatedAt` the caller saw. */
  expectedUpdatedAt?: number;
  /** Staff actions are audited; system jobs (auto-complete) are not. */
  auditAsStaff: boolean;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  nova: "Primljena",
  potvrdjena: "Potvrđena",
  ceka_deo: "Čeka deo",
  spremna_za_preuzimanje: "Spremna za preuzimanje",
  poslata: "Poslata",
  preuzeta: "Preuzeta",
  isporucena: "Isporučena",
  zavrsena: "Završena",
  otkazana: "Otkazana",
};

export async function transitionOrder(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  to: OrderStatus,
  opts: TransitionOptions,
): Promise<void> {
  const order = await ctx.db.get("orders", orderId);
  if (!order) return fail("NOT_FOUND", "Porudžbina ne postoji.");
  if (opts.expectedUpdatedAt !== undefined && opts.expectedUpdatedAt !== order.updatedAt) {
    fail("CONFLICT", "Porudžbina je u međuvremenu izmenjena — osvežite.");
  }
  const check = checkOrderTransition(order.status, to, {
    deliveryMethod: order.delivery.method,
    ...(opts.reason ? { reason: opts.reason } : {}),
    ...(opts.tracking ? { trackingNumber: opts.tracking.trackingNumber } : {}),
  });
  if (!check.ok)
    fail(
      check.error === "same_status" ? "CONFLICT" : "INVALID",
      ORDER_TRANSITION_ERRORS_SR[check.error],
      { error: check.error },
    );

  const settings = await getSettings(ctx);
  const now = Date.now();
  const patch: Partial<Doc<"orders">> = { status: to, updatedAt: now };
  switch (to) {
    case "potvrdjena":
      patch.confirmedAt = order.confirmedAt ?? now;
      break;
    case "spremna_za_preuzimanje":
      patch.readyAt = now;
      break;
    case "poslata": {
      patch.shippedAt = now;
      if (opts.tracking) {
        const courier = settings.couriers.find((c) => c.code === opts.tracking!.courierCode);
        const trackingNumber = opts.tracking.trackingNumber.trim().slice(0, 60);
        patch.delivery = {
          ...order.delivery,
          courierCode: opts.tracking.courierCode,
          trackingNumber,
          ...(courier?.trackingUrlTemplate
            ? {
                trackingUrl: courier.trackingUrlTemplate.replace(
                  "{broj}",
                  encodeURIComponent(trackingNumber),
                ),
              }
            : {}),
        };
      }
      break;
    }
    case "preuzeta":
      patch.pickedUpAt = now;
      break;
    case "isporucena":
      patch.deliveredAt = now;
      break;
    case "zavrsena":
      patch.completedAt = now;
      break;
    case "otkazana":
      patch.cancelledAt = now;
      patch.cancelReason = opts.reason!.trim().slice(0, 500);
      patch.cancelledBy = opts.actor;
      break;
    default:
      break;
  }
  if (opts.auditAsStaff) {
    patch.lastStaffActionAt = now;
    patch.reminderLevel = 0;
  }
  await ctx.db.patch("orders", orderId, patch);

  if (commitsStockOn(to, settings.commerce.stockDecrementOn) && !order.stockCommitted) {
    await commitStock(ctx, orderId, "order_confirmed", opts.actor);
  }
  if (to === "otkazana" && order.stockCommitted && settings.commerce.restockOnCancel) {
    await restock(ctx, orderId, opts.actor);
  }

  await ctx.db.insert("orderEvents", {
    orderId,
    type: "status_changed",
    fromStatus: order.status,
    toStatus: to,
    message:
      to === "otkazana"
        ? `Otkazana: ${patch.cancelReason}`
        : to === "poslata" && patch.delivery?.trackingNumber
          ? `Poslata, broj pošiljke ${patch.delivery.trackingNumber}`
          : STATUS_LABEL[to],
    visibleToCustomer: true,
    actor: opts.actor,
    at: now,
  });
  await emitEvent(ctx, {
    type: "order.status_changed",
    aggregateType: "order",
    aggregateId: orderId,
    payload: {
      kind: "order",
      orderId,
      number: order.number,
      from: order.status,
      to,
      ...(patch.cancelReason ? { reason: patch.cancelReason } : {}),
    },
    dedupeKey: `order.status_changed:${orderId}:${to}:${now}`,
    actor: opts.actor,
  });
  if (opts.auditAsStaff) {
    await audit(ctx, {
      actor: opts.actor,
      action: "order.transition",
      entityType: "order",
      entityId: orderId,
      summary: `${order.number}: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[to]}`,
      diff: [{ field: "status", before: order.status, after: to }],
    });
  }
  if (to === "otkazana" && !order.isDemo && !order.isTest) {
    await bumpStatsDaily(ctx, now, { cancelledCount: 1 });
  }
}

export { STATUS_LABEL as ORDER_STATUS_LABEL_SR };
