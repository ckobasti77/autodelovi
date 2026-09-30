/**
 * Scheduled automations (docs/NOTIFICATIONS.md §I3). Convex crons run in UTC; every local-time
 * rule goes through `lib/domain/time` + `lib/domain/sla` (Europe/Belgrade, DST-safe), and
 * once-per-slot jobs are guarded by `cronRuns` keys. Every handler is idempotent and bounded.
 */
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { isWithinOpeningHours, reminderLevelFor, workingMinutesBetween } from "../lib/domain/sla";
import { pruneAttributionIds } from "../lib/domain/attribution";
import { isAvailableNow } from "../lib/domain/stock";
import { belgradeDay, belgradeParts, DAY_MS } from "../lib/domain/time";
import { SYSTEM_ACTOR } from "./lib/authz";
import { previousBelgradeDay } from "./lib/emailData";
import { resendConfigured } from "./lib/env";
import { emitEvent } from "./lib/events";
import { getSettings } from "./lib/settings";

const HOUR_MS = 3_600_000;

async function lastRun(ctx: MutationCtx, job: string): Promise<Doc<"cronRuns"> | null> {
  return await ctx.db
    .query("cronRuns")
    .withIndex("by_job_and_localKey", (q) => q.eq("job", job))
    .order("desc")
    .first();
}

async function hasRun(ctx: MutationCtx, job: string, localKey: string): Promise<boolean> {
  const row = await ctx.db
    .query("cronRuns")
    .withIndex("by_job_and_localKey", (q) => q.eq("job", job).eq("localKey", localKey))
    .first();
  return row !== null;
}

/** `2026-09-30T08` — the Belgrade hour slot. */
function hourKey(ms: number): string {
  const p = belgradeParts(ms);
  return `${belgradeDay(ms)}T${String(p.hour).padStart(2, "0")}`;
}

// Reminders ------------------------------------------------------------------------------

/**
 * Every 15 min, only inside Belgrade opening hours: orders in `nova` and inquiries in `nov`
 * that waited longer than `reminderAfterWorkingMinutes` of working time get a reminder
 * (level 1), and a second one 120 working minutes later (level 2).
 */
export const runReminders = internalMutation({
  args: {},
  returns: v.object({ checked: v.number(), reminded: v.number(), skipped: v.boolean() }),
  handler: async (ctx) => {
    const now = Date.now();
    const settings = await getSettings(ctx);
    const holidays = settings.holidays.map((h) => h.date);
    if (!isWithinOpeningHours(now, settings.hours, holidays)) {
      return { checked: 0, reminded: 0, skipped: true };
    }
    const target = settings.notifications.reminderAfterWorkingMinutes;
    let checked = 0;
    let reminded = 0;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "nova"))
      .take(200);
    for (const order of orders) {
      if (order.isTest) continue;
      checked++;
      const minutes = workingMinutesBetween(
        order.lastStaffActionAt ?? order._creationTime,
        now,
        settings.hours,
        holidays,
      );
      const level = reminderLevelFor(minutes, target);
      if (level <= order.reminderLevel) continue;
      await ctx.db.patch("orders", order._id, { reminderLevel: level });
      await emitEvent(ctx, {
        type: "reminder.due",
        aggregateType: "order",
        aggregateId: order._id,
        payload: {
          kind: "reminder",
          target: "order",
          orderId: order._id,
          number: order.number,
          level,
          workingMinutes: minutes,
        },
        dedupeKey: `reminder:order:${order._id}:${level}:${order.lastStaffActionAt ?? 0}`,
        actor: SYSTEM_ACTOR,
      });
      reminded++;
    }

    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_status", (q) => q.eq("status", "nov"))
      .take(200);
    for (const inquiry of inquiries) {
      if (inquiry.isTest) continue;
      checked++;
      const minutes = workingMinutesBetween(
        inquiry.lastStaffActionAt ?? inquiry._creationTime,
        now,
        settings.hours,
        holidays,
      );
      const level = reminderLevelFor(minutes, target);
      if (level <= inquiry.reminderLevel) continue;
      await ctx.db.patch("inquiries", inquiry._id, { reminderLevel: level });
      await emitEvent(ctx, {
        type: "reminder.due",
        aggregateType: "inquiry",
        aggregateId: inquiry._id,
        payload: {
          kind: "reminder",
          target: "inquiry",
          inquiryId: inquiry._id,
          number: inquiry.number,
          level,
          workingMinutes: minutes,
        },
        dedupeKey: `reminder:inquiry:${inquiry._id}:${level}:${inquiry.lastStaffActionAt ?? 0}`,
        actor: SYSTEM_ACTOR,
      });
      reminded++;
    }
    return { checked, reminded, skipped: false };
  },
});

// Daily digest ---------------------------------------------------------------------------

/**
 * Hourly at :00 UTC; acts only when the Belgrade hour equals `digestHour` (default 8) and the
 * local day has no `digest:<day>` run yet — exactly once per local day across DST changes.
 */
export const runDigest = internalMutation({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    const now = Date.now();
    const settings = await getSettings(ctx);
    if (!settings.notifications.digestEnabled) return null;
    if (belgradeParts(now).hour !== settings.notifications.digestHour) return null;
    const today = belgradeDay(now);
    if (await hasRun(ctx, "digest", today)) return null;
    await ctx.db.insert("cronRuns", { job: "digest", localKey: today, ranAt: now });
    const day = previousBelgradeDay(now);
    await emitEvent(ctx, {
      type: "digest.daily",
      aggregateType: "system",
      aggregateId: `digest:${today}`,
      payload: { kind: "digest", day },
      dedupeKey: `digest:${today}`,
      actor: SYSTEM_ACTOR,
    });
    return day;
  },
});

// Low stock (batched e-mail, ≤ 1 per hour) -------------------------------------------

export const lowStockSweep = internalMutation({
  args: {},
  returns: v.object({ items: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const key = hourKey(now);
    if (await hasRun(ctx, "lowStock", key)) return { items: 0 };
    const previous = await lastRun(ctx, "lowStock");
    const since = previous?.ranAt ?? now - HOUR_MS;
    await ctx.db.insert("cronRuns", { job: "lowStock", localKey: key, ranAt: now });
    const events = await ctx.db
      .query("domainEvents")
      .withIndex("by_type", (q) => q.eq("type", "stock.low").gt("_creationTime", since))
      .take(500);
    const seen = new Set<string>();
    const items: { productId: Id<"products">; sku: string; name: string; qty: number }[] = [];
    for (const event of events) {
      if (event.payload.kind !== "stock" || seen.has(event.payload.productId)) continue;
      seen.add(event.payload.productId);
      const product = await ctx.db.get("products", event.payload.productId);
      // Only products that are still low or out now (a receipt may have fixed it).
      if (!product || !product.active) continue;
      if (product.stockState !== "low_stock" && product.stockState !== "out_of_stock") continue;
      items.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        qty: product.stockQty,
      });
    }
    if (items.length === 0) return { items: 0 };
    await emitEvent(ctx, {
      type: "stock.low_digest",
      aggregateType: "stock",
      aggregateId: `low:${key}`,
      payload: { kind: "stock_batch", items: items.slice(0, 30), total: items.length },
      dedupeKey: `stock.low_digest:${key}`,
      actor: SYSTEM_ACTOR,
    });
    return { items: items.length };
  },
});

// Back in stock (safety net for missed events) -----------------------------------------

export const backInStockSweep = internalMutation({
  args: {},
  returns: v.object({ products: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const key = hourKey(now);
    const subs = await ctx.db
      .query("backInStockSubscriptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(500);
    const productIds = [...new Set(subs.map((s) => s.productId))];
    let emitted = 0;
    for (const productId of productIds.slice(0, 100)) {
      const product = await ctx.db.get("products", productId);
      if (!product || !product.active || !isAvailableNow(product.stockState)) continue;
      await emitEvent(ctx, {
        type: "stock.back_in_stock",
        aggregateType: "stock",
        aggregateId: productId,
        payload: {
          kind: "stock",
          productId,
          sku: product.sku,
          name: product.name,
          qty: product.stockQty,
        },
        dedupeKey: `stock.back_in_stock:sweep:${productId}:${key}`,
        actor: SYSTEM_ACTOR,
      });
      emitted++;
    }
    return { products: emitted };
  },
});

// Quotes about to expire -------------------------------------------------------------------

/** Sent quotes that expire within 24 h (and were valid for more than 36 h) → customer reminder. */
export const quoteExpiringSweep = internalMutation({
  args: {},
  returns: v.object({ reminded: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("quotes")
      .withIndex("by_status_and_validUntil", (q) =>
        q
          .eq("status", "sent")
          .gt("validUntil", now)
          .lte("validUntil", now + 24 * HOUR_MS),
      )
      .take(100);
    let reminded = 0;
    for (const quote of due) {
      if (quote.sentAt !== undefined && quote.validUntil - quote.sentAt <= 36 * HOUR_MS) continue;
      const inquiry = await ctx.db.get("inquiries", quote.inquiryId);
      if (!inquiry || inquiry.currentQuoteId !== quote._id || inquiry.status !== "ponuda_poslata")
        continue;
      if (!inquiry.contact.email) continue;
      await emitEvent(ctx, {
        type: "quote.expiring",
        aggregateType: "quote",
        aggregateId: quote._id,
        payload: {
          kind: "inquiry",
          inquiryId: inquiry._id,
          number: inquiry.number,
          quoteId: quote._id,
          version: quote.version,
        },
        dedupeKey: `quote.expiring:${quote._id}`,
        actor: SYSTEM_ACTOR,
      });
      reminded++;
    }
    return { reminded };
  },
});

// Nightly maintenance ------------------------------------------------------------------

const BATCH = 200;
const RETENTION = {
  emailHtmlMs: 90 * DAY_MS,
  emailLogMs: 730 * DAY_MS,
  searchLogsMs: 180 * DAY_MS,
  eventsMs: 90 * DAY_MS,
  notificationsMs: 180 * DAY_MS,
  subscriptionAfterNotifyMs: 30 * DAY_MS,
  subscriptionMaxMs: 365 * DAY_MS,
  consentMs: 730 * DAY_MS,
  auditMs: 5 * 365 * DAY_MS,
  cronRunsMs: 90 * DAY_MS,
  guestCartMs: 30 * DAY_MS,
  orphanUploadMs: DAY_MS,
  capiContextMs: 7 * DAY_MS,
  clickIdsMs: 180 * DAY_MS,
} as const;

type PruneCounts = Record<string, number>;

async function pruneOrphanUploads(ctx: MutationCtx, now: number, counts: PruneCounts) {
  const cursor = await lastRun(ctx, "orphanScan");
  const from = cursor?.ranAt ?? 0;
  const until = now - RETENTION.orphanUploadMs;
  const settings = await getSettings(ctx);
  const files = await ctx.db.system
    .query("_storage")
    .withIndex("by_creation_time", (q) => q.gt("_creationTime", from).lt("_creationTime", until))
    .take(BATCH);
  let deleted = 0;
  for (const file of files) {
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", file._id))
      .first();
    if (upload) continue;
    if (settings.seo.ogImageStorageId === file._id) continue;
    await ctx.storage.delete(file._id);
    deleted++;
  }
  const last = files[files.length - 1];
  if (last) {
    // The watermark is a cronRuns row whose `ranAt` holds the last scanned creation time.
    if (cursor) await ctx.db.patch("cronRuns", cursor._id, { ranAt: last._creationTime });
    else
      await ctx.db.insert("cronRuns", {
        job: "orphanScan",
        localKey: "cursor",
        ranAt: last._creationTime,
      });
  }
  counts.orphanUploads = deleted;
  return files.length === BATCH;
}

async function pruneEmailLog(ctx: MutationCtx, now: number, counts: PruneCounts) {
  let more = false;
  const htmlCursor = await lastRun(ctx, "emailHtml");
  const rows = await ctx.db
    .query("emailLog")
    .withIndex("by_creation_time", (q) =>
      q
        .gt("_creationTime", htmlCursor?.ranAt ?? 0)
        .lt("_creationTime", now - RETENTION.emailHtmlMs),
    )
    .take(BATCH);
  let stripped = 0;
  for (const row of rows) {
    if (row.html !== undefined) {
      await ctx.db.patch("emailLog", row._id, { html: undefined });
      stripped++;
    }
  }
  const last = rows[rows.length - 1];
  if (last) {
    if (htmlCursor) await ctx.db.patch("cronRuns", htmlCursor._id, { ranAt: last._creationTime });
    else
      await ctx.db.insert("cronRuns", {
        job: "emailHtml",
        localKey: "cursor",
        ranAt: last._creationTime,
      });
  }
  more ||= rows.length === BATCH;
  const old = await ctx.db
    .query("emailLog")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", now - RETENTION.emailLogMs))
    .take(BATCH);
  for (const row of old) await ctx.db.delete("emailLog", row._id);
  more ||= old.length === BATCH;
  counts.emailHtmlStripped = stripped;
  counts.emailLogDeleted = old.length;
  return more;
}

async function pruneSimple(ctx: MutationCtx, now: number, counts: PruneCounts) {
  let more = false;
  const searchLogs = await ctx.db
    .query("searchLogs")
    .withIndex("by_at", (q) => q.lt("at", now - RETENTION.searchLogsMs))
    .take(BATCH);
  for (const row of searchLogs) await ctx.db.delete("searchLogs", row._id);
  counts.searchLogs = searchLogs.length;
  more ||= searchLogs.length === BATCH;

  const events = await ctx.db
    .query("domainEvents")
    .withIndex("by_status_and_nextAttemptAt", (q) =>
      q.eq("status", "done").lt("nextAttemptAt", now - RETENTION.eventsMs),
    )
    .take(100);
  for (const event of events) {
    const deliveries = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_eventId_and_channel_and_recipient", (q) => q.eq("eventId", event._id))
      .take(100);
    for (const d of deliveries) await ctx.db.delete("notificationDeliveries", d._id);
    await ctx.db.delete("domainEvents", event._id);
  }
  counts.events = events.length;
  more ||= events.length === 100;

  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", now - RETENTION.notificationsMs))
    .take(BATCH);
  for (const row of notifications) await ctx.db.delete("notifications", row._id);
  counts.notifications = notifications.length;
  more ||= notifications.length === BATCH;

  let subs = 0;
  for (const status of ["notified", "cancelled", "active"] as const) {
    const cutoff =
      status === "active" ? RETENTION.subscriptionMaxMs : RETENTION.subscriptionAfterNotifyMs;
    const rows = await ctx.db
      .query("backInStockSubscriptions")
      .withIndex("by_status", (q) => q.eq("status", status).lt("_creationTime", now - cutoff))
      .take(BATCH);
    for (const row of rows) {
      if (
        status === "notified" &&
        (row.notifiedAt ?? 0) > now - RETENTION.subscriptionAfterNotifyMs
      )
        continue;
      await ctx.db.delete("backInStockSubscriptions", row._id);
      subs++;
    }
    more ||= rows.length === BATCH;
  }
  counts.subscriptions = subs;

  const consent = await ctx.db
    .query("consentRecords")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", now - RETENTION.consentMs))
    .take(BATCH);
  for (const row of consent) await ctx.db.delete("consentRecords", row._id);
  counts.consentRecords = consent.length;

  const audit = await ctx.db
    .query("auditLog")
    .withIndex("by_at", (q) => q.lt("at", now - RETENTION.auditMs))
    .take(BATCH);
  for (const row of audit) await ctx.db.delete("auditLog", row._id);
  counts.auditLog = audit.length;

  const runs = await ctx.db
    .query("cronRuns")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", now - RETENTION.cronRunsMs))
    .take(BATCH);
  let runsDeleted = 0;
  for (const row of runs) {
    if (row.localKey === "cursor") continue; // watermarks live forever
    await ctx.db.delete("cronRuns", row._id);
    runsDeleted++;
  }
  counts.cronRuns = runsDeleted;

  // Guest carts in every state: idle active ones, and the empty merged/converted shells.
  let cartsDeleted = 0;
  for (const status of ["active", "merged", "converted", "abandoned"] as const) {
    const carts = await ctx.db
      .query("carts")
      .withIndex("by_ownerType_and_status_and_updatedAt", (q) =>
        q
          .eq("ownerType", "guest")
          .eq("status", status)
          .lt("updatedAt", now - RETENTION.guestCartMs),
      )
      .take(50);
    for (const cart of carts) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_cartId", (q) => q.eq("cartId", cart._id))
        .take(200);
      for (const item of items) await ctx.db.delete("cartItems", item._id);
      await ctx.db.delete("carts", cart._id);
      cartsDeleted++;
    }
    more ||= carts.length === 50;
  }
  counts.guestCarts = cartsDeleted;
  return more;
}

/** Creation-time watermark of a pruning pass (a `cronRuns` row with localKey `cursor`). */
async function watermark(ctx: MutationCtx, job: string) {
  const row = await lastRun(ctx, job);
  return {
    from: row?.ranAt ?? 0,
    async save(ranAt: number) {
      if (row) await ctx.db.patch("cronRuns", row._id, { ranAt });
      else await ctx.db.insert("cronRuns", { job, localKey: "cursor", ranAt });
    },
  };
}

/**
 * Tracking data (SECURITY §L5): the Meta CAPI context (IP, user agent) of an event is kept at
 * most 7 days (`capi.finish` already clears it once the send is final); click ids and
 * browser ids on orders, inquiries and mechanic profiles are masked after 180 days.
 */
async function pruneTracking(ctx: MutationCtx, now: number, counts: PruneCounts) {
  let more = false;
  const capiMark = await watermark(ctx, "capiContext");
  const events = await ctx.db
    .query("domainEvents")
    .withIndex("by_creation_time", (q) =>
      q.gt("_creationTime", capiMark.from).lt("_creationTime", now - RETENTION.capiContextMs),
    )
    .take(BATCH);
  let capi = 0;
  for (const event of events) {
    if (event.capiContext === undefined) continue;
    await ctx.db.patch("domainEvents", event._id, { capiContext: undefined });
    capi++;
  }
  const lastEvent = events[events.length - 1];
  if (lastEvent) await capiMark.save(lastEvent._creationTime);
  counts.capiContext = capi;
  more ||= events.length === BATCH;

  let clickIds = 0;
  const until = now - RETENTION.clickIdsMs;
  for (const table of ["orders", "inquiries", "mechanicProfiles"] as const) {
    const mark = await watermark(ctx, `clickIds:${table}`);
    const rows = await ctx.db
      .query(table)
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", mark.from).lt("_creationTime", until))
      .take(BATCH);
    for (const row of rows) {
      const pruned = row.attribution ? pruneAttributionIds(row.attribution) : null;
      if (!pruned) continue;
      await ctx.db.patch(table, row._id, { attribution: pruned });
      clickIds++;
    }
    const last = rows[rows.length - 1];
    if (last) await mark.save(last._creationTime);
    more ||= rows.length === BATCH;
  }
  counts.clickIds = clickIds;
  return more;
}

/**
 * 02:30/03:30 Belgrade: orphaned uploads (no `uploads` row after 24 h), retention pruning
 * (docs/SECURITY.md §L5) incl. tracking identifiers, stale guest carts and the Resend component's own cleanup. Each
 * part works in bounded batches and the job re-schedules itself (≤ 10 rounds) while a batch
 * came back full.
 */
export const nightly = internalMutation({
  args: { round: v.optional(v.number()) },
  returns: v.record(v.string(), v.number()),
  handler: async (ctx, { round = 0 }) => {
    const now = Date.now();
    const counts: PruneCounts = {};
    const moreUploads = await pruneOrphanUploads(ctx, now, counts);
    const moreEmail = await pruneEmailLog(ctx, now, counts);
    const moreSimple = await pruneSimple(ctx, now, counts);
    const moreTracking = await pruneTracking(ctx, now, counts);
    if (round === 0 && resendConfigured().apiKey) {
      await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {
        olderThan: 7 * DAY_MS,
      });
      await ctx.scheduler.runAfter(0, components.resend.lib.cleanupAbandonedEmails, {
        olderThan: 28 * DAY_MS,
      });
    }
    if ((moreUploads || moreEmail || moreSimple || moreTracking) && round < 10) {
      await ctx.scheduler.runAfter(60_000, internal.automations.nightly, { round: round + 1 });
    }
    return counts;
  },
});
