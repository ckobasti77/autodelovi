/**
 * Demo data lifecycle (docs/DATA-MODEL.md demo invariant, ARCHITECTURE §E8): every seeded
 * product, user, mechanic profile, order, inquiry, cart, subscription and notification is
 * `isDemo`; reference data (vehicles, categories, manufacturers, tiers) stays.
 * Removal runs in self-rescheduling chunks so it never hits transaction limits.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { actorOf, SYSTEM_ACTOR } from "./lib/authz";
import { invalid } from "./lib/errors";
import { ownerMutation, ownerQuery } from "./lib/functions";
import { deleteProductHard } from "./lib/productWriter";

export const CONFIRM_PHRASE = "OBRIŠI DEMO";
const CHUNK = 20;

const PHASES = [
  "orders",
  "inquiries",
  "carts",
  "subscriptions",
  "notifications",
  "mechanics",
  "users",
  "products",
  "done",
] as const;
type Phase = (typeof PHASES)[number];
const phaseV = v.union(
  v.literal("orders"),
  v.literal("inquiries"),
  v.literal("carts"),
  v.literal("subscriptions"),
  v.literal("notifications"),
  v.literal("mechanics"),
  v.literal("users"),
  v.literal("products"),
  v.literal("done"),
);

async function deleteEvents(
  ctx: MutationCtx,
  aggregateType: "order" | "inquiry" | "quote" | "mechanic" | "product" | "stock",
  aggregateId: string,
) {
  const events = await ctx.db
    .query("domainEvents")
    .withIndex("by_aggregateType_and_aggregateId", (q) =>
      q.eq("aggregateType", aggregateType).eq("aggregateId", aggregateId),
    )
    .take(100);
  for (const e of events) {
    const deliveries = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_eventId_and_channel_and_recipient", (q) => q.eq("eventId", e._id))
      .take(200);
    for (const d of deliveries) await ctx.db.delete("notificationDeliveries", d._id);
    await ctx.db.delete("domainEvents", e._id);
  }
}

async function deleteOrder(ctx: MutationCtx, orderId: Id<"orders">) {
  for (const item of await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(300)) {
    await ctx.db.delete("orderItems", item._id);
  }
  for (const e of await ctx.db
    .query("orderEvents")
    .withIndex("by_orderId_and_at", (q) => q.eq("orderId", orderId))
    .take(300)) {
    await ctx.db.delete("orderEvents", e._id);
  }
  await deleteEvents(ctx, "order", orderId);
  await ctx.db.delete("orders", orderId);
}

async function deleteInquiry(ctx: MutationCtx, inquiryId: Id<"inquiries">) {
  const inquiry = await ctx.db.get("inquiries", inquiryId);
  if (!inquiry) return;
  for (const e of await ctx.db
    .query("inquiryEvents")
    .withIndex("by_inquiryId_and_at", (q) => q.eq("inquiryId", inquiryId))
    .take(300)) {
    await ctx.db.delete("inquiryEvents", e._id);
  }
  for (const quote of await ctx.db
    .query("quotes")
    .withIndex("by_inquiryId_and_version", (q) => q.eq("inquiryId", inquiryId))
    .take(50)) {
    await deleteEvents(ctx, "quote", quote._id);
    await ctx.db.delete("quotes", quote._id);
  }
  for (const storageId of inquiry.photos) {
    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    if (upload) await ctx.db.delete("uploads", upload._id);
    await ctx.storage.delete(storageId);
  }
  await deleteEvents(ctx, "inquiry", inquiryId);
  await ctx.db.delete("inquiries", inquiryId);
}

async function deleteUser(ctx: MutationCtx, userId: Id<"users">) {
  for (const n of await ctx.db
    .query("notifications")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(500)) {
    await ctx.db.delete("notifications", n._id);
  }
  for (const s of await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .take(100)) {
    for (const t of await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
      .take(200)) {
      await ctx.db.delete("authRefreshTokens", t._id);
    }
    await ctx.db.delete("authSessions", s._id);
  }
  for (const a of await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .take(20)) {
    for (const c of await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", a._id))
      .take(50)) {
      await ctx.db.delete("authVerificationCodes", c._id);
    }
    await ctx.db.delete("authAccounts", a._id);
  }
  for (const sv of await ctx.db
    .query("savedVehicles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(200)) {
    await ctx.db.delete("savedVehicles", sv._id);
  }
  for (const f of await ctx.db
    .query("favorites")
    .withIndex("by_userId_and_productId", (q) => q.eq("userId", userId))
    .take(500)) {
    await ctx.db.delete("favorites", f._id);
  }
  await ctx.db.delete("users", userId);
}

/** Deletes one chunk of the current phase; returns true when the phase is finished. */
async function runPhase(ctx: MutationCtx, phase: Phase): Promise<boolean> {
  switch (phase) {
    case "orders": {
      const rows = await ctx.db
        .query("orders")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK);
      for (const r of rows) await deleteOrder(ctx, r._id);
      return rows.length < CHUNK;
    }
    case "inquiries": {
      const rows = await ctx.db
        .query("inquiries")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK);
      for (const r of rows) await deleteInquiry(ctx, r._id);
      return rows.length < CHUNK;
    }
    case "carts": {
      const rows = await ctx.db
        .query("carts")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK);
      for (const cart of rows) {
        for (const i of await ctx.db
          .query("cartItems")
          .withIndex("by_cartId", (q) => q.eq("cartId", cart._id))
          .take(200)) {
          await ctx.db.delete("cartItems", i._id);
        }
        await ctx.db.delete("carts", cart._id);
      }
      return rows.length < CHUNK;
    }
    case "subscriptions": {
      const rows = await ctx.db
        .query("backInStockSubscriptions")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK * 5);
      for (const r of rows) await ctx.db.delete("backInStockSubscriptions", r._id);
      return rows.length < CHUNK * 5;
    }
    case "notifications": {
      const rows = await ctx.db
        .query("notifications")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK * 10);
      for (const r of rows) await ctx.db.delete("notifications", r._id);
      return rows.length < CHUNK * 10;
    }
    case "mechanics": {
      const rows = await ctx.db
        .query("mechanicProfiles")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK);
      for (const r of rows) {
        await deleteEvents(ctx, "mechanic", r._id);
        const user = await ctx.db.get("users", r.userId);
        if (user && !user.isDemo)
          await ctx.db.patch("users", user._id, {
            mechanicStatus: "none",
            mechanicProfileId: undefined,
          });
        await ctx.db.delete("mechanicProfiles", r._id);
      }
      return rows.length < CHUNK;
    }
    case "users": {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK);
      for (const r of rows) {
        // Never remove staff accounts, even if someone flagged them.
        if (r.role === "owner" || r.role === "staff") {
          await ctx.db.patch("users", r._id, { isDemo: false });
          continue;
        }
        await deleteUser(ctx, r._id);
      }
      return rows.length < CHUNK;
    }
    case "products": {
      const rows = await ctx.db
        .query("products")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(CHUNK);
      for (const r of rows) {
        await deleteEvents(ctx, "product", r._id);
        await deleteEvents(ctx, "stock", r._id);
        await deleteProductHard(ctx, r._id);
      }
      return rows.length < CHUNK;
    }
    case "done":
      return true;
  }
}

/** Internal: removes every demo row, chunk by chunk (self-rescheduling). */
export const removeDemoData = internalMutation({
  args: { phase: v.optional(phaseV) },
  returns: v.object({ phase: phaseV, finished: v.boolean() }),
  handler: async (ctx, args) => {
    let phase: Phase = args.phase ?? "orders";
    const phaseDone = await runPhase(ctx, phase);
    if (phaseDone) phase = PHASES[PHASES.indexOf(phase) + 1] ?? "done";
    if (phase !== "done") {
      await ctx.scheduler.runAfter(0, internal.demo.removeDemoData, { phase });
      return { phase, finished: false };
    }
    await audit(ctx, {
      actor: SYSTEM_ACTOR,
      action: "demo.removed",
      entityType: "system",
      entityId: "demo",
      summary: "Demo podaci su obrisani",
    });
    return { phase, finished: true };
  },
});

export const status = ownerQuery({
  args: {},
  returns: v.object({
    products: v.number(),
    orders: v.number(),
    inquiries: v.number(),
    users: v.number(),
    mechanics: v.number(),
  }),
  handler: async (ctx) => {
    const count = async (
      table: "products" | "orders" | "inquiries" | "users" | "mechanicProfiles",
    ) =>
      (
        await ctx.db
          .query(table)
          .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
          .take(1_000)
      ).length;
    return {
      products: await count("products"),
      orders: await count("orders"),
      inquiries: await count("inquiries"),
      users: await count("users"),
      mechanics: await count("mechanicProfiles"),
    };
  },
});

/** Owner: „Obriši demo podatke“ with the typed confirmation phrase. */
export const remove = ownerMutation({
  args: { confirm: v.string() },
  returns: v.null(),
  handler: async (ctx, { confirm }) => {
    if (confirm.trim() !== CONFIRM_PHRASE) invalid(`Upišite tačno: ${CONFIRM_PHRASE}`, "confirm");
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "demo.remove_requested",
      entityType: "system",
      entityId: "demo",
      summary: "Pokrenuto brisanje demo podataka",
    });
    await ctx.scheduler.runAfter(0, internal.demo.removeDemoData, {});
    return null;
  },
});
