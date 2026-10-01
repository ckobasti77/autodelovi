/**
 * Outbox dispatcher (docs/NOTIFICATIONS.md §I1–I2).
 *
 * `dispatch` resolves recipients (settings + staff preferences) for one event, writes the
 * idempotency ledger `notificationDeliveries` (unique per event × channel × recipient),
 * creates in-app notifications inline and schedules one `notify.deliverEmail` per e-mail
 * recipient (rendering, sending and per-recipient retries live there). A failed dispatch
 * retries with backoff (1 min, 5 min, 30 min, 2 h, 12 h) and is `dead` after 5 attempts;
 * `sweep` (every minute) re-dispatches due `pending`/`failed` events.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { formatRsdPlain } from "../lib/domain/money";
import { normalizeEmail, isValidEmail } from "../lib/domain/identifiers";
import type { TemplateKey } from "../lib/email/registry";
import { metaCapiToken } from "./lib/env";
import { getSettings } from "./lib/settings";
import type { Settings } from "./lib/settingsSchema";
import { revalidateEnabled, revalidateTags } from "./revalidate";

export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const MAX_STAFF_RECIPIENTS = 50;
const MAX_BACK_IN_STOCK_PER_EVENT = 200;

/** Delay before retry number `attempts` (1-based count of failed attempts so far). */
export function retryDelayMs(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts, 1) - 1, RETRY_DELAYS_MS.length - 1)]!;
}

export type StaffPrefKey = "orderNew" | "inquiryNew" | "mechanicNew" | "lowStock" | "reminders";
export type EmailPrefKey = StaffPrefKey | "digest";

type InAppMessage = {
  kind: string;
  title: string;
  body: string;
  href: string;
  /** Staff preference that can mute this notification. */
  pref?: StaffPrefKey;
};

/** Staff-facing in-app message for an event, or null when staff are not notified in-app. */
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
    case "reminder.due": {
      if (p.kind !== "reminder") return null;
      const isOrder = p.target === "order";
      return {
        kind: "reminder",
        title: `${p.level >= 2 ? "Drugi podsetnik" : "Podsetnik"}: ${isOrder ? `porudžbina ${p.number} čeka potvrdu` : `upit ${p.number} čeka odgovor`}`,
        body: `Čeka ${Math.floor(p.workingMinutes / 60)} h ${p.workingMinutes % 60} min radnog vremena.`,
        href: isOrder ? `/admin/porudzbine/${p.number}` : `/admin/upiti/${p.number}`,
        pref: "reminders",
      };
    }
    case "email.bounced":
    case "email.complained": {
      if (p.kind !== "email") return null;
      const bounced = event.type === "email.bounced";
      return {
        kind: bounced ? "email_bounced" : "email_complained",
        title: bounced ? `E-pošta nije isporučena: ${p.to}` : `Prijava neželjene pošte: ${p.to}`,
        body: `${p.subject}${p.reason ? ` — ${p.reason}` : ""}. Kontaktirajte kupca telefonom.`,
        href: p.href ?? "/admin/mejlovi",
      };
    }
    case "import.completed": {
      if (p.kind !== "import") return null;
      const extra = [
        p.failed ? `${p.failed} neuspelih` : "",
        p.deactivated ? `${p.deactivated} deaktiviranih` : "",
      ].filter(Boolean);
      return {
        kind: "import_done",
        title: `Uvoz završen: ${p.fileName}`,
        body: `${p.created} novih, ${p.updated} izmenjenih${extra.length ? `, ${extra.join(", ")}` : ""}.`,
        href: `/admin/uvoz/${p.batchId}`,
      };
    }
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

const ORDER_STATUS_TEMPLATE: Partial<Record<string, TemplateKey>> = {
  potvrdjena: "order_confirmed",
  ceka_deo: "order_backordered",
  spremna_za_preuzimanje: "order_ready_pickup",
  poslata: "order_shipped",
  isporucena: "order_delivered",
  preuzeta: "order_delivered",
  otkazana: "order_cancelled",
};

/** Staff e-mail template for an event and the preference that gates it. */
export function staffEmailFor(
  event: Doc<"domainEvents">,
): { templateKey: TemplateKey; pref: EmailPrefKey } | null {
  switch (event.type) {
    case "order.created":
      return { templateKey: "staff_order_new", pref: "orderNew" };
    case "inquiry.created":
      return { templateKey: "staff_inquiry_new", pref: "inquiryNew" };
    case "mechanic.registered":
      return { templateKey: "staff_mechanic_new", pref: "mechanicNew" };
    case "quote.accepted":
      return { templateKey: "staff_quote_accepted", pref: "orderNew" };
    case "quote.renewal_requested":
      return { templateKey: "staff_quote_renewal", pref: "inquiryNew" };
    case "stock.low_digest":
      return { templateKey: "staff_low_stock", pref: "lowStock" };
    case "digest.daily":
      return { templateKey: "staff_daily_digest", pref: "digest" };
    case "reminder.due":
      return { templateKey: "staff_reminder", pref: "reminders" };
    default:
      return null;
  }
}

type AggregateFlags = { isDemo: boolean; isTest: boolean };

/** Demo notifications are removable; demo and e2e aggregates are only ever logged. */
async function aggregateFlags(
  ctx: MutationCtx,
  event: Doc<"domainEvents">,
): Promise<AggregateFlags> {
  const p = event.payload;
  const flags = (doc: { isDemo?: boolean; isTest?: boolean } | null | undefined) => ({
    isDemo: doc?.isDemo ?? false,
    isTest: doc?.isTest ?? false,
  });
  switch (p.kind) {
    case "order":
      return flags(await ctx.db.get("orders", p.orderId));
    case "inquiry":
      return flags(await ctx.db.get("inquiries", p.inquiryId));
    case "mechanic":
      return flags(await ctx.db.get("mechanicProfiles", p.profileId));
    case "stock":
      return flags(await ctx.db.get("products", p.productId));
    case "catalog":
      return p.productId ? flags(await ctx.db.get("products", p.productId)) : flags(null);
    case "reminder":
      return p.orderId
        ? flags(await ctx.db.get("orders", p.orderId))
        : p.inquiryId
          ? flags(await ctx.db.get("inquiries", p.inquiryId))
          : flags(null);
    default:
      return flags(null);
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

/** Queues one e-mail delivery (idempotent per event × recipient). */
async function queueEmail(
  ctx: MutationCtx,
  eventId: Id<"domainEvents">,
  recipient: string,
  templateKey: TemplateKey,
): Promise<boolean> {
  const existing = await ctx.db
    .query("notificationDeliveries")
    .withIndex("by_eventId_and_channel_and_recipient", (q) =>
      q.eq("eventId", eventId).eq("channel", "email").eq("recipient", recipient),
    )
    .unique();
  if (existing) return false;
  const deliveryId = await ctx.db.insert("notificationDeliveries", {
    eventId,
    channel: "email",
    recipient,
    templateKey,
    status: "pending",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.notify.deliverEmail, { deliveryId });
  return true;
}

export async function staffRecipients(ctx: MutationCtx): Promise<Doc<"users">[]> {
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

async function staffPrefs(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("staffPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Staff e-mail addresses for a preference: every active owner/staff account whose own
 * preference is on, plus the shared addresses from settings (deduplicated; an address that
 * belongs to a staff account follows that account's preference). Global switches: the digest
 * (`digestEnabled`) and low-stock e-mails (`lowStockEmail`).
 */
export async function staffEmailRecipients(
  ctx: MutationCtx,
  pref: EmailPrefKey,
  settings: Settings,
): Promise<string[]> {
  if (pref === "digest" && !settings.notifications.digestEnabled) return [];
  if (pref === "lowStock" && !settings.notifications.lowStockEmail) return [];
  const wanted = new Map<string, boolean>();
  for (const user of await staffRecipients(ctx)) {
    if (!user.email) continue;
    const email = normalizeEmail(user.email);
    if (!isValidEmail(email)) continue;
    const prefs = await staffPrefs(ctx, user._id);
    wanted.set(email, prefs ? prefs.email[pref] : true);
  }
  for (const raw of settings.notifications.staffEmails) {
    const email = normalizeEmail(raw);
    if (isValidEmail(email) && !wanted.has(email)) wanted.set(email, true);
  }
  return [...wanted].filter(([, on]) => on).map(([email]) => email);
}

async function staffWantsInApp(
  ctx: MutationCtx,
  userId: Id<"users">,
  pref: StaffPrefKey | undefined,
): Promise<boolean> {
  if (!pref) return true;
  const prefs = await staffPrefs(ctx, userId);
  return prefs ? prefs.inApp[pref] : true;
}

/** Customer / applicant / subscriber e-mails for an event. */
async function customerEmails(
  ctx: MutationCtx,
  event: Doc<"domainEvents">,
): Promise<{ recipient: string; templateKey: TemplateKey }[]> {
  const p = event.payload;
  switch (event.type) {
    case "order.created":
    case "order.status_changed": {
      if (p.kind !== "order") return [];
      const templateKey =
        event.type === "order.created"
          ? "order_received"
          : p.to
            ? ORDER_STATUS_TEMPLATE[p.to]
            : undefined;
      if (!templateKey) return [];
      const order = await ctx.db.get("orders", p.orderId);
      // Staff orders for phone-only customers carry no e-mail (D223).
      return order?.contact.email
        ? [{ recipient: normalizeEmail(order.contact.email), templateKey }]
        : [];
    }
    case "inquiry.created":
    case "quote.sent":
    case "quote.expiring": {
      if (p.kind !== "inquiry") return [];
      const inquiry = await ctx.db.get("inquiries", p.inquiryId);
      if (!inquiry?.contact.email) return [];
      const templateKey: TemplateKey =
        event.type === "inquiry.created"
          ? "inquiry_received"
          : event.type === "quote.sent"
            ? "quote_ready"
            : "quote_expiring";
      return [{ recipient: normalizeEmail(inquiry.contact.email), templateKey }];
    }
    case "mechanic.registered":
    case "mechanic.approved":
    case "mechanic.rejected":
    case "mechanic.suspended": {
      if (p.kind !== "mechanic") return [];
      const profile = await ctx.db.get("mechanicProfiles", p.profileId);
      if (!profile) return [];
      const templateKey: TemplateKey =
        event.type === "mechanic.registered"
          ? "mechanic_registration_received"
          : event.type === "mechanic.approved"
            ? "mechanic_approved"
            : event.type === "mechanic.rejected"
              ? "mechanic_rejected"
              : "mechanic_suspended";
      return [{ recipient: normalizeEmail(profile.email), templateKey }];
    }
    case "stock.back_in_stock": {
      if (p.kind !== "stock") return [];
      const subs = await ctx.db
        .query("backInStockSubscriptions")
        .withIndex("by_productId_and_status", (q) =>
          q.eq("productId", p.productId).eq("status", "active"),
        )
        .take(MAX_BACK_IN_STOCK_PER_EVENT);
      // One delivery per subscription; the recipient key carries the subscription id.
      return subs.map((s) => ({
        recipient: `sub:${s._id}`,
        templateKey: "back_in_stock" as const,
      }));
    }
    default:
      return [];
  }
}

/** Server twins of browser conversions (Meta CAPI, SEO-ADS §J7). */
const CAPI_EVENT_TYPES: ReadonlySet<string> = new Set([
  "order.created",
  "inquiry.created",
  "mechanic.registered",
]);

/** Queues one non-e-mail delivery (idempotent per event × channel × recipient). */
async function queueDelivery(
  ctx: MutationCtx,
  eventId: Id<"domainEvents">,
  channel: "meta_capi" | "revalidate",
  recipient: string,
): Promise<Id<"notificationDeliveries"> | null> {
  const existing = await ctx.db
    .query("notificationDeliveries")
    .withIndex("by_eventId_and_channel_and_recipient", (q) =>
      q.eq("eventId", eventId).eq("channel", channel).eq("recipient", recipient),
    )
    .unique();
  if (existing) return null;
  return await ctx.db.insert("notificationDeliveries", {
    eventId,
    channel,
    recipient,
    status: "pending",
    attempts: 0,
  });
}

/**
 * Meta Conversions API: only when enabled in settings with a Pixel id and a token; the
 * consent and demo checks happen in `capi.job` (the ledger row records why it was skipped).
 */
async function queueCapi(ctx: MutationCtx, event: Doc<"domainEvents">, settings: Settings) {
  if (!CAPI_EVENT_TYPES.has(event.type)) return;
  const t = settings.tracking;
  if (!t.metaCapiEnabled || !t.metaPixelId?.trim() || !metaCapiToken()) return;
  const deliveryId = await queueDelivery(ctx, event._id, "meta_capi", "meta");
  if (deliveryId) await ctx.scheduler.runAfter(0, internal.capi.send, { deliveryId });
}

/** Next cache purge for catalog/settings/content changes (deployed sites only). */
async function queueRevalidate(ctx: MutationCtx, event: Doc<"domainEvents">) {
  if (!revalidateTags(event) || !revalidateEnabled()) return;
  const deliveryId = await queueDelivery(ctx, event._id, "revalidate", "next");
  if (deliveryId) await ctx.scheduler.runAfter(0, internal.revalidate.send, { deliveryId });
}

async function processEvent(ctx: MutationCtx, event: Doc<"domainEvents">): Promise<void> {
  const flags = await aggregateFlags(ctx, event);
  const settings = await getSettings(ctx);

  await queueCapi(ctx, event, settings);
  await queueRevalidate(ctx, event);

  // In-app: staff (with preferences) and the mechanic whose profile changed.
  const staff = staffMessage(event);
  if (staff) {
    const initiator = event.type === "import.completed" ? event.actor?.userId : undefined;
    for (const user of await staffRecipients(ctx)) {
      if (initiator && user._id !== initiator) continue;
      if (await staffWantsInApp(ctx, user._id, staff.pref)) {
        await deliverInApp(ctx, event, user._id, staff, flags.isDemo);
      }
    }
  }
  const mechanic = mechanicMessage(event);
  if (mechanic) await deliverInApp(ctx, event, mechanic.userId, mechanic, flags.isDemo);

  // E-mail: customers / applicants / subscribers.
  for (const target of await customerEmails(ctx, event)) {
    if (target.recipient.startsWith("sub:") || isValidEmail(target.recipient)) {
      await queueEmail(ctx, event._id, target.recipient, target.templateKey);
    }
  }

  // E-mail: staff.
  const staffEmail = staffEmailFor(event);
  if (staffEmail) {
    // An accepted quote already e-mails staff („Ponuda prihvaćena“) for the order it creates.
    if (event.type === "order.created" && event.payload.kind === "order") {
      const order = await ctx.db.get("orders", event.payload.orderId);
      if (order?.source === "inquiry") return;
    }
    for (const email of await staffEmailRecipients(ctx, staffEmail.pref, settings)) {
      await queueEmail(ctx, event._id, email, staffEmail.templateKey);
    }
  }
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
        nextAttemptAt: Date.now() + retryDelayMs(attempts),
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
