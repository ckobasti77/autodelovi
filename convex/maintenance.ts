/**
 * Scheduled maintenance (docs/NOTIFICATIONS.md §I3): quote expiry and order auto-completion.
 * Reminders, the digest, stock e-mails and retention pruning live in `automations.ts`.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { SYSTEM_ACTOR } from "./lib/authz";
import { emitEvent } from "./lib/events";
import { setInquiryStatus } from "./lib/inquiries";
import { transitionOrder } from "./lib/orders";
import { issueStatusLink } from "./lib/linkTokens";
import { getSettings } from "./lib/settings";
import { internalMutation } from "./_generated/server";

const BATCH = 100;

/** Sent quotes past `validUntil` → `expired`; their inquiries → `istekla`. */
export const expireQuotes = internalMutation({
  args: {},
  returns: v.object({ expired: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("quotes")
      .withIndex("by_status_and_validUntil", (q) => q.eq("status", "sent").lt("validUntil", now))
      .take(BATCH);
    for (const quote of due) {
      await ctx.db.patch("quotes", quote._id, { status: "expired" });
      const inquiry = await ctx.db.get("inquiries", quote.inquiryId);
      if (inquiry && inquiry.currentQuoteId === quote._id && inquiry.status === "ponuda_poslata") {
        await setInquiryStatus(ctx, inquiry, "istekla", {
          actor: SYSTEM_ACTOR,
          staff: false,
          message: "Ponuda je istekla.",
        });
        await emitEvent(ctx, {
          type: "quote.expired",
          aggregateType: "quote",
          aggregateId: quote._id,
          payload: {
            kind: "inquiry",
            inquiryId: inquiry._id,
            number: inquiry.number,
            quoteId: quote._id,
            version: quote.version,
          },
          dedupeKey: `quote.expired:${quote._id}`,
          actor: SYSTEM_ACTOR,
        });
      }
    }
    return { expired: due.length };
  },
});

/** Picked-up / delivered orders older than `autoCompleteDays` → `zavrsena`. */
export const autoCompleteOrders = internalMutation({
  args: {},
  returns: v.object({ completed: v.number() }),
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const cutoff = Date.now() - settings.commerce.autoCompleteDays * 86_400_000;
    let completed = 0;
    for (const status of ["preuzeta", "isporucena"] as const) {
      const rows = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(BATCH);
      for (const order of rows) {
        const doneAt = order.pickedUpAt ?? order.deliveredAt ?? order.updatedAt;
        if (doneAt > cutoff) continue;
        await transitionOrder(ctx, order._id, "zavrsena", {
          actor: SYSTEM_ACTOR,
          auditAsStaff: false,
        });
        completed++;
      }
    }
    return { completed };
  },
});

/**
 * One-off / after rotating LINK_TOKEN_SECRET: re-derives `publicTokenHash` of orders and
 * inquiries so e-mailed status links match (lib/linkTokens). Links issued before stop working.
 * Run: `npx convex run maintenance:rekeyStatusLinks '{"table":"orders"}'` (self-continuing).
 */
export const rekeyStatusLinks = internalMutation({
  args: {
    table: v.union(v.literal("orders"), v.literal("inquiries")),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ updated: v.number(), done: v.boolean() }),
  handler: async (ctx, { table, cursor }) => {
    const page = await ctx.db.query(table).paginate({ numItems: BATCH, cursor: cursor ?? null });
    let updated = 0;
    for (const doc of page.page) {
      const { tokenHash } = await issueStatusLink(
        table === "orders" ? "order" : "inquiry",
        doc.number,
      );
      if (doc.publicTokenHash !== tokenHash) {
        await ctx.db.patch(table, doc._id, { publicTokenHash: tokenHash });
        updated++;
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.maintenance.rekeyStatusLinks, {
        table,
        cursor: page.continueCursor,
      });
    }
    return { updated, done: page.isDone };
  },
});

/**
 * One-off (step 20): accounts created before sign-up set `role: "customer"` had no role and
 * were missing from Admin → Kupci and the customer export (both read the `by_role` index).
 * Run: `npx convex run maintenance:backfillCustomerRole` (self-continuing, idempotent).
 */
export const backfillCustomerRole = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ updated: v.number(), done: v.boolean() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", undefined))
      .paginate({ numItems: BATCH, cursor: cursor ?? null });
    for (const user of page.page) await ctx.db.patch("users", user._id, { role: "customer" });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.maintenance.backfillCustomerRole, {
        cursor: page.continueCursor,
      });
    }
    return { updated: page.page.length, done: page.isDone };
  },
});
