/**
 * Scheduled maintenance (docs/NOTIFICATIONS.md §I3). Step 05 ships quote expiry and order
 * auto-completion; step 18 adds reminders, digest, pruning and reconciliation.
 */
import { v } from "convex/values";

import { SYSTEM_ACTOR } from "./lib/authz";
import { emitEvent } from "./lib/events";
import { setInquiryStatus } from "./lib/inquiries";
import { transitionOrder } from "./lib/orders";
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
