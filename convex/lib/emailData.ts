/**
 * Documents → template data (lib/email/types). Read-only helpers used by the e-mail
 * delivery mutation; every list is bounded.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminLink, siteLink, type EmailContext } from "../../lib/email/context";
import { workingAge } from "../../lib/email/templates/shared";
import type {
  EmailLine,
  InquiryEmailData,
  MechanicEmailData,
  OrderEmailData,
  QuoteEmailData,
  StaffDigestEmailData,
  StaffInquiryEmailData,
  StaffMechanicEmailData,
  StaffOrderEmailData,
} from "../../lib/email/types";
import { workingMinutesBetween } from "../../lib/domain/sla";
import { belgradeDay, belgradeLocalToUtc, belgradeParts } from "../../lib/domain/time";
import { statusLinkToken } from "./linkTokens";
import type { Settings } from "./settingsSchema";

const MAX_LINES = 25;

function daysText(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 === 1 && mod100 !== 11 ? `${n} dan` : `${n} dana`;
}

function availabilityNote(state: string, leadTimeDays: number | undefined): string | undefined {
  if (state !== "on_order" && state !== "out_of_stock") return undefined;
  return leadTimeDays ? `Po porudžbini, rok ${daysText(leadTimeDays)}` : "Po porudžbini";
}

function addressText(a: { street: string; city: string; postalCode: string } | undefined): string {
  if (!a) return "";
  return [a.street, [a.postalCode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export async function orderStatusUrl(
  ectx: EmailContext,
  number: string,
  campaign: string,
  suffix = "",
): Promise<string> {
  return siteLink(ectx, `/porudzbina/${await statusLinkToken("order", number)}${suffix}`, campaign);
}

export async function inquiryStatusUrl(
  ectx: EmailContext,
  number: string,
  campaign: string,
): Promise<string> {
  return siteLink(ectx, `/upit/${await statusLinkToken("inquiry", number)}`, campaign);
}

async function orderLines(
  ctx: QueryCtx,
  orderId: Id<"orders">,
): Promise<{ lines: EmailLine[]; more: number }> {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(300);
  const lines = items.slice(0, MAX_LINES).map((i) => {
    const note = availabilityNote(i.availabilityAtOrder, i.leadTimeDays);
    return {
      name: i.name,
      sku: i.oem ?? i.sku,
      manufacturer: i.manufacturerName,
      quantity: i.quantity,
      unitPricePara: i.unitPricePara,
      lineTotalPara: i.lineTotalPara,
      ...(note ? { availabilityNote: note } : {}),
    };
  });
  return { lines, more: Math.max(0, items.length - MAX_LINES) };
}

export async function orderEmailData(
  ctx: QueryCtx,
  order: Doc<"orders">,
  settings: Settings,
  ectx: EmailContext,
  campaign: string,
): Promise<OrderEmailData> {
  const { lines, more } = await orderLines(ctx, order._id);
  const delivery = settings.deliveryMethods.find((d) => d.code === order.delivery.method);
  const payment = settings.paymentMethods.find((p) => p.code === order.payment.method);
  const courier = order.delivery.courierCode
    ? settings.couriers.find((c) => c.code === order.delivery.courierCode)
    : undefined;
  const statusUrl = await orderStatusUrl(ectx, order.number, campaign);
  const bankTransfer = order.payment.method === "bank_transfer";
  return {
    number: order.number,
    statusUrl,
    status: order.status,
    createdAt: order._creationTime,
    firstName: order.contact.firstName,
    customerType: order.customerType,
    lines,
    moreLines: more,
    totals: {
      itemsRetailPara: order.totals.itemsRetailPara,
      discountPara: order.totals.discountPara,
      itemsPara: order.totals.itemsPara,
      deliveryPara: order.totals.deliveryPara,
      totalPara: order.totals.totalPara,
      vatPara: order.totals.vatPara,
    },
    delivery: {
      method: order.delivery.method,
      label: delivery?.label ?? (order.delivery.method === "pickup" ? "Lično preuzimanje" : "Kurirska služba"),
      ...(order.delivery.address ? { address: addressText(order.delivery.address) } : {}),
      ...(courier ? { courierName: courier.name } : {}),
      ...(order.delivery.trackingNumber ? { trackingNumber: order.delivery.trackingNumber } : {}),
      ...(order.delivery.trackingUrl ? { trackingUrl: order.delivery.trackingUrl } : {}),
    },
    payment: {
      method: order.payment.method,
      label: payment?.label ?? order.payment.method,
      instructions: payment?.instructions ?? "",
      reference: order.payment.reference,
      ...(order.payment.dueAt ? { dueAt: order.payment.dueAt } : {}),
    },
    ...(order.company ? { company: { name: order.company.name, pib: order.company.pib } } : {}),
    hasBackorder: order.hasBackorder,
    ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    ...(bankTransfer
      ? {
          bank: {
            recipient:
              settings.company.legalName.trim() || settings.company.displayName?.trim() || ectx.brandName,
            accounts: settings.company.bankAccounts,
            reference: order.payment.reference,
            amountPara: order.totals.totalPara,
          },
          proformaUrl: await orderStatusUrl(ectx, order.number, campaign, "/predracun"),
        }
      : {}),
    complaintsUrl: siteLink(ectx, "/reklamacije-i-povrat", campaign),
    termsUrl: siteLink(ectx, "/uslovi-koriscenja", campaign),
  };
}

function quoteLines(quote: Doc<"quotes">): EmailLine[] {
  return quote.lines.map((l) => {
    const note =
      l.availability === "on_order"
        ? l.leadTimeDays
          ? `Po porudžbini, rok ${daysText(l.leadTimeDays)}`
          : "Po porudžbini"
        : undefined;
    return {
      name: l.name,
      ...(l.sku ? { sku: l.sku } : {}),
      ...(l.manufacturer ? { manufacturer: l.manufacturer } : {}),
      quantity: l.quantity,
      unitPricePara: l.unitPricePara,
      lineTotalPara: l.unitPricePara * l.quantity,
      ...(note || l.note ? { availabilityNote: [note, l.note].filter(Boolean).join(" · ") } : {}),
    };
  });
}

export function quoteEmailData(quote: Doc<"quotes">): QuoteEmailData {
  return {
    version: quote.version,
    validUntil: quote.validUntil,
    lines: quoteLines(quote),
    totalPara: quote.totalPara,
    ...(quote.deliveryNote ? { deliveryNote: quote.deliveryNote } : {}),
  };
}

export async function inquiryEmailData(
  inquiry: Doc<"inquiries">,
  quote: Doc<"quotes"> | null,
  ectx: EmailContext,
  campaign: string,
): Promise<InquiryEmailData> {
  const excerpt = inquiry.message.replace(/\s+/g, " ").trim();
  return {
    number: inquiry.number,
    statusUrl: await inquiryStatusUrl(ectx, inquiry.number, campaign),
    name: inquiry.contact.name,
    createdAt: inquiry._creationTime,
    ...(inquiry.vehicle?.label ? { vehicleLabel: inquiry.vehicle.label } : {}),
    ...(inquiry.vin ? { vin: inquiry.vin } : {}),
    messageExcerpt: excerpt.length > 300 ? `${excerpt.slice(0, 300).trim()}…` : excerpt,
    requestedCodes: inquiry.requestedCodes,
    photoCount: inquiry.photos.length,
    preferredChannel: inquiry.contact.preferredChannel,
    ...(quote ? { quote: quoteEmailData(quote) } : {}),
  };
}

function percentLabel(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1).replace(".", ",")} %`;
}

export async function mechanicEmailData(
  ctx: QueryCtx,
  profile: Doc<"mechanicProfiles">,
  ectx: EmailContext,
  campaign: string,
  reason?: string,
): Promise<MechanicEmailData> {
  const tier = profile.tierId ? await ctx.db.get("priceTiers", profile.tierId) : null;
  const bp = profile.personalRules?.defaultDiscountBp ?? tier?.defaultDiscountBp;
  const why = reason ?? profile.rejectionReason;
  return {
    companyName: profile.companyName,
    contactPerson: profile.contactPerson,
    email: profile.email,
    ...(tier ? { tierName: tier.name } : {}),
    ...(bp !== undefined && bp > 0 ? { discountLabel: percentLabel(bp) } : {}),
    creditEnabled: profile.creditEnabled,
    paymentTermsDays: profile.paymentTermsDays,
    ...(why ? { reason: why } : {}),
    portalUrl: siteLink(ectx, "/majstor", campaign),
    loginUrl: siteLink(ectx, "/prijava", campaign),
    registrationUrl: siteLink(ectx, "/za-majstore/registracija", campaign),
  };
}

const SOURCE_LABEL: Record<Doc<"orders">["source"], string> = {
  web: "sajt",
  inquiry: "prihvaćena ponuda",
  admin: "uneto u administraciji",
  quick_order: "brza porudžbina",
  reorder: "ponovljena porudžbina",
};

function attributionLabel(order: Doc<"orders">): string {
  const touch = order.attribution?.last ?? order.attribution?.first;
  const bits = [SOURCE_LABEL[order.source]];
  if (touch?.gclid || touch?.gbraid || touch?.wbraid) bits.push("Google Ads");
  else if (touch?.fbclid) bits.push("Meta");
  else if (touch?.source) bits.push(touch.source);
  if (touch?.campaign) bits.push(touch.campaign);
  return bits.join(" · ");
}

export async function staffOrderData(
  ctx: QueryCtx,
  order: Doc<"orders">,
  settings: Settings,
  ectx: EmailContext,
): Promise<StaffOrderEmailData> {
  const { lines, more } = await orderLines(ctx, order._id);
  const delivery = settings.deliveryMethods.find((d) => d.code === order.delivery.method);
  const payment = settings.paymentMethods.find((p) => p.code === order.payment.method);
  return {
    number: order.number,
    adminUrl: adminLink(ectx, `/admin/porudzbine/${order.number}`),
    customerName: `${order.contact.firstName} ${order.contact.lastName}`.trim(),
    customerType: order.customerType,
    ...(order.company ? { companyName: order.company.name } : {}),
    ...(order.tierSnapshot ? { tierName: order.tierSnapshot.name } : {}),
    phone: order.contact.phone,
    email: order.contact.email,
    totalPara: order.totals.totalPara,
    itemCount: order.itemCount,
    lines,
    moreLines: more,
    deliveryLabel: delivery?.label ?? order.delivery.method,
    paymentLabel: payment?.label ?? order.payment.method,
    ...(order.customerNote ? { note: order.customerNote } : {}),
    hasBackorder: order.hasBackorder,
    source: attributionLabel(order),
  };
}

export async function staffInquiryData(
  ctx: QueryCtx,
  inquiry: Doc<"inquiries">,
  ectx: EmailContext,
): Promise<StaffInquiryEmailData> {
  const categoryLabels: string[] = [];
  for (const slug of inquiry.categorySlugs.slice(0, 5)) {
    const cat = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    // „Turbina (turbopunjač)“ → „turbina“ for a short subject line.
    categoryLabels.push(cat ? cat.name.replace(/\s*\(.*\)\s*$/, "").toLowerCase() : slug);
  }
  const excerpt = inquiry.message.replace(/\s+/g, " ").trim();
  return {
    number: inquiry.number,
    adminUrl: adminLink(ectx, `/admin/upiti/${inquiry.number}`),
    name: inquiry.contact.name,
    ...(inquiry.contact.phone ? { phone: inquiry.contact.phone } : {}),
    ...(inquiry.contact.email ? { email: inquiry.contact.email } : {}),
    preferredChannel: inquiry.contact.preferredChannel,
    ...(inquiry.vehicle?.label ? { vehicleLabel: inquiry.vehicle.label } : {}),
    ...(inquiry.vin ? { vin: inquiry.vin } : {}),
    categoryLabels,
    messageExcerpt: excerpt.length > 500 ? `${excerpt.slice(0, 500).trim()}…` : excerpt,
    requestedCodes: inquiry.requestedCodes,
    photoCount: inquiry.photos.length,
    isMechanic: Boolean(inquiry.mechanicProfileId),
  };
}

export function staffMechanicData(
  profile: Doc<"mechanicProfiles">,
  ectx: EmailContext,
): StaffMechanicEmailData {
  return {
    companyName: profile.companyName,
    pib: profile.pib,
    city: profile.city,
    contactPerson: profile.contactPerson,
    phone: profile.phone,
    email: profile.email,
    serviceTypes: profile.serviceTypes,
    adminUrl: adminLink(ectx, `/admin/majstori/${profile._id}`),
  };
}

/** Start of the Belgrade day `YYYY-MM-DD` as epoch ms. */
export function belgradeDayStart(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return belgradeLocalToUtc(y!, m!, d!);
}

/** The Belgrade day before the one containing `ms`. */
export function previousBelgradeDay(ms: number): string {
  const p = belgradeParts(ms);
  return belgradeDay(belgradeLocalToUtc(p.year, p.month, p.day) - 12 * 3_600_000);
}

export async function digestData(
  ctx: QueryCtx,
  day: string,
  now: number,
  settings: Settings,
  ectx: EmailContext,
): Promise<StaffDigestEmailData> {
  const holidays = settings.holidays.map((h) => h.date);
  const age = (from: number) =>
    workingAge(workingMinutesBetween(from, now, settings.hours, holidays));
  const stats = await ctx.db
    .query("statsDaily")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  const openOrders = (
    await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "nova"))
      .take(200)
  ).filter((o) => !o.isTest);
  const openInquiries = [
    ...(await ctx.db
      .query("inquiries")
      .withIndex("by_status", (q) => q.eq("status", "nov"))
      .take(200)),
    ...(await ctx.db
      .query("inquiries")
      .withIndex("by_status", (q) => q.eq("status", "u_obradi"))
      .take(200)),
  ]
    .filter((i) => !i.isTest)
    .sort((a, b) => a._creationTime - b._creationTime);
  const pending = await ctx.db
    .query("mechanicProfiles")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(20);
  const low = await ctx.db
    .query("products")
    .withIndex("by_stockState_and_active", (q) => q.eq("stockState", "low_stock").eq("active", true))
    .take(1000);
  const out = await ctx.db
    .query("products")
    .withIndex("by_stockState_and_active", (q) =>
      q.eq("stockState", "out_of_stock").eq("active", true),
    )
    .take(1000);
  const searches = await ctx.db
    .query("searchDaily")
    .withIndex("by_day_and_normalized", (q) => q.eq("day", day))
    .take(1000);
  const zero = searches
    .filter((s) => s.zeroCount > 0)
    .sort((a, b) => b.zeroCount - a.zeroCount)
    .slice(0, 5)
    .map((s) => ({ query: s.sample, count: s.zeroCount }));
  return {
    day: belgradeDayStart(day) + 12 * 3_600_000,
    orders: {
      count: stats?.ordersCount ?? 0,
      valuePara: stats?.ordersValuePara ?? 0,
      cancelled: stats?.cancelledCount ?? 0,
    },
    inquiriesReceived: stats?.inquiriesCount ?? 0,
    registrations: stats?.registrationsCount ?? 0,
    openOrders: openOrders.slice(0, 5).map((o) => ({
      number: o.number,
      ageLabel: age(o.lastStaffActionAt ?? o._creationTime),
      url: adminLink(ectx, `/admin/porudzbine/${o.number}`),
    })),
    openOrderCount: openOrders.length,
    openInquiries: openInquiries.slice(0, 5).map((i) => ({
      number: i.number,
      ageLabel: age(i._creationTime),
      url: adminLink(ectx, `/admin/upiti/${i.number}`),
    })),
    openInquiryCount: openInquiries.length,
    pendingMechanics: pending
      .slice(0, 5)
      .map((p) => ({ companyName: p.companyName, url: adminLink(ectx, `/admin/majstori/${p._id}`) })),
    lowStockCount: low.length,
    outOfStockCount: out.length,
    zeroSearches: zero,
    dashboardUrl: adminLink(ectx, "/admin"),
    stockUrl: adminLink(ectx, "/admin/lager"),
    searchesUrl: adminLink(ectx, "/admin/pretrage"),
  };
}
