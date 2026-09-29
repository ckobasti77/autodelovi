/**
 * Outbox dispatcher (docs/NOTIFICATIONS.md §I1). Step 05 scope: in-app notifications only;
 * e-mail, Meta CAPI and cache revalidation channels are added in steps 18–19 on top of the
 * same idempotency ledger (`notificationDeliveries`).
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { formatRsdPlain } from "../lib/domain/money";

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const MAX_STAFF_RECIPIENTS = 50;

type StaffPrefKey = "orderNew" | "inquiryNew" | "mechanicNew" | "lowStock" | "reminders";

type InAppMessage = {
  kind: string;
  title: string;
  body: string;
  href: string;
  /** Staff preference that can mute this notification. */
  pref?: StaffPrefKey;
};

/** Staff-facing in-app message for an event, or null when staff are not notified. */
export function staffMessage(event: Doc<"domainEvents">): InAppMessage | null {
  const p = event.payload;
  switch (event.type) {
    case "order.created":
      if (p.kind !== "order") return null;
      return {
        kind: "order_new",
        title: `Nova porudžbina ${p.number}`,
        body:
          p.totalPara !== undefined
            ? `Ukupno ${formatRsdPlain(p.totalPara)}`
            : "Nova porudžbina čeka potvrdu.",
        href: `/admin/porudzbine/${p.number}`,
        pref: "orderNew",
      };
    case "inquiry.created":
      if (p.kind !== "inquiry") return null;
      return {
        kind: "inquiry_new",
        title: `Novi upit ${p.number}`,
        body: "Kupac čeka ponudu.",
        href: `/admin/upiti/${p.number}`,
        pref: "inquiryNew",
      };
    case "quote.accepted":
      if (p.kind !== "inquiry") return null;
      return {
        kind: "quote_accepted",
        title: `Ponuda prihvaćena — ${p.number}`,
        body: "Kupac je prihvatio ponudu; porudžbina je kreirana.",
        href: `/admin/upiti/${p.number}`,
        pref: "orderNew",
      };
    case "quote.declined":
      if (p.kind !== "inquiry") return null;
      return {
        kind: "quote_declined",
        title: `Ponuda odbijena — ${p.number}`,
        body: p.reason ? `Razlog: ${p.reason}` : "Kupac je odbio ponudu.",
        href: `/admin/upiti/${p.number}`,
        pref: "inquiryNew",
      };
    case "quote.renewal_requested":
      if (p.kind !== "inquiry") return null;
      return {
        kind: "quote_renewal",
        title: `Traži se obnovljena ponuda — ${p.number}`,
        body: "Ponuda je istekla; kupac traži novu.",
        href: `/admin/upiti/${p.number}`,
        pref: "inquiryNew",
      };
    case "quote.expired":
      if (p.kind !== "inquiry") return null;
      return {
        kind: "quote_expired",
        title: `Ponuda istekla — ${p.number}`,
        body: "Kupac nije odgovorio do isteka ponude.",
        href: `/admin/upiti/${p.number}`,
        pref: "reminders",
      };
    case "mechanic.registered":
      if (p.kind !== "mechanic") return null;
      return {
        kind: "mechanic_new",
        title: "Nova registracija majstora",
        body: `${p.companyName} čeka odobrenje.`,
        href: `/admin/majstori/${p.profileId}`,
        pref: "mechanicNew",
      };
    case "stock.low":
      if (p.kind !== "stock") return null;
      return {
        kind: "stock_low",
        title: p.qty === 0 ? `Nema na stanju: ${p.sku}` : `Malo na stanju: ${p.sku}`,
        body: `${p.name} — ostalo ${p.qty} kom.`,
        href: `/admin/proizvodi/${p.productId}`,
        pref: "lowStock",
      };
    default:
      return null;
  }
}

/** Message for the mechanic whose profile changed, or null. */
export function mechanicMessage(
  event: Doc<"domainEvents">,
): (InAppMessage & { userId: Id<"users"> }) | null {
  const p = event.payload;
  if (p.kind !== "mechanic") return null;
  switch (event.type) {
    case "mechanic.approved":
      return {
        userId: p.userId,
        kind: "mechanic_approved",
        title: "Nalog je odobren",
        body: p.tierName
          ? `Vaš razred: ${p.tierName}. Cene su sada vaše cene.`
          : "Cene su sada vaše cene.",
        href: "/majstor",
      };
    case "mechanic.rejected":
      return {
        userId: p.userId,
        kind: "mechanic_rejected",
        title: "Registracija nije odobrena",
        body: p.reason ?? "Pozovite nas za detalje.",
        href: "/majstor",
      };
    case "mechanic.suspended":
      return {
        userId: p.userId,
        kind: "mechanic_suspended",
        title: "Majstorski nalog je pauziran",
        body: "Do ponovne aktivacije vidite maloprodajne cene.",
        href: "/majstor",
      };
    default:
      return null;
  }
}

/** Notifications about demo records are flagged so „Obriši demo podatke“ removes them. */
async function aggregateIsDemo(ctx: MutationCtx, event: Doc<"domainEvents">): Promise<boolean> {
  const p = event.payload;
  switch (p.kind) {
    case "order":
      return (await ctx.db.get("orders", p.orderId))?.isDemo ?? false;
    case "inquiry":
      return (await ctx.db.get("inquiries", p.inquiryId))?.isDemo ?? false;
    case "mechanic":
      return (await ctx.db.get("mechanicProfiles", p.profileId))?.isDemo ?? false;
    case "stock":
      return (await ctx.db.get("products", p.productId))?.isDemo ?? false;
    case "catalog":
      return p.productId ? ((await ctx.db.get("products", p.productId))?.isDemo ?? false) : false;
    default:
      return false;
  }
}

async function deliverInApp(
  ctx: MutationCtx,
  event: Doc<"domainEvents">,
  userId: Id<"users">,
  message: InAppMessage,
  isDemo: boolean,
): Promise<void> {
  const recipient = userId as string;
  const existing = await ctx.db
    .query("notificationDeliveries")
    .withIndex("by_eventId_and_channel_and_recipient", (q) =>
      q.eq("eventId", event._id).eq("channel", "inapp").eq("recipient", recipient),
    )
    .unique();
  if (existing) return;
  await ctx.db.insert("notifications", {
    userId,
    kind: message.kind,
    title: message.title,
    body: message.body,
    href: message.href,
    eventId: event._id,
    read: false,
    ...(isDemo ? { isDemo: true } : {}),
  });
  await ctx.db.insert("notificationDeliveries", {
    eventId: event._id,
    channel: "inapp",
    recipient,
    status: "sent",
    attempts: 1,
    sentAt: Date.now(),
  });
}

async function staffRecipients(ctx: MutationCtx): Promise<Doc<"users">[]> {
  const owners = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "owner"))
    .take(MAX_STAFF_RECIPIENTS);
  const staff = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "staff"))
    .take(MAX_STAFF_RECIPIENTS);
  return [...owners, ...staff].filter((u) => u.status !== "blocked");
}

async function staffWantsInApp(
  ctx: MutationCtx,
  userId: Id<"users">,
  pref: StaffPrefKey | undefined,
): Promise<boolean> {
  if (!pref) return true;
  const prefs = await ctx.db
    .query("staffPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return prefs ? prefs.inApp[pref] : true;
}

async function processEvent(ctx: MutationCtx, event: Doc<"domainEvents">): Promise<void> {
  const staff = staffMessage(event);
  const mechanic = mechanicMessage(event);
  if (!staff && !mechanic) return;
  const isDemo = await aggregateIsDemo(ctx, event);
  if (staff) {
    for (const user of await staffRecipients(ctx)) {
      if (await staffWantsInApp(ctx, user._id, staff.pref)) {
        await deliverInApp(ctx, event, user._id, staff, isDemo);
      }
    }
  }
  if (mechanic) await deliverInApp(ctx, event, mechanic.userId, mechanic, isDemo);
}

export const dispatch = internalMutation({
  args: { eventId: v.id("domainEvents") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get("domainEvents", eventId);
    if (!event || event.status === "done" || event.status === "dead") return null;
    const attempts = event.attempts + 1;
    try {
      await processEvent(ctx, event);
      await ctx.db.patch("domainEvents", eventId, {
        status: "done",
        attempts,
        processedAt: Date.now(),
        lastError: undefined,
      });
    } catch (error) {
      // Deliveries written before the failure stay (idempotent); the event retries later.
      const message = error instanceof Error ? error.message : String(error);
      const dead = attempts >= MAX_ATTEMPTS;
      await ctx.db.patch("domainEvents", eventId, {
        status: dead ? "dead" : "failed",
        attempts,
        lastError: message.slice(0, 500),
        nextAttemptAt:
          Date.now() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)],
      });
    }
    return null;
  },
});

/** Re-dispatches pending/failed events whose retry time has passed (cron, every minute). */
export const sweep = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    let scheduled = 0;
    for (const status of ["pending", "failed"] as const) {
      const due = await ctx.db
        .query("domainEvents")
        .withIndex("by_status_and_nextAttemptAt", (q) =>
          q.eq("status", status).lte("nextAttemptAt", now - 30_000),
        )
        .take(100);
      for (const event of due) {
        await ctx.scheduler.runAfter(0, internal.events.dispatch, { eventId: event._id });
        scheduled++;
      }
    }
    return { scheduled };
  },
});
