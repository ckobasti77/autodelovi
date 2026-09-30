/**
 * In-app notifications (bell) for the signed-in user.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { notFound } from "./lib/errors";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import {
  ownerMutation,
  ownerQuery,
  staffMutation,
  staffQuery,
  userMutation,
  userQuery,
} from "./lib/functions";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const notificationV = v.object({
  _id: v.id("notifications"),
  kind: v.string(),
  title: v.string(),
  body: v.string(),
  href: v.string(),
  read: v.boolean(),
  createdAt: v.number(),
});

export const mine = userQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(notificationV),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((n) => ({
        _id: n._id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        createdAt: n._creationTime,
      })),
    };
  },
});

export const unreadCount = userQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", ctx.viewer.userId).eq("read", false))
      .take(100);
    return rows.length;
  },
});

export const markRead = userMutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, { notificationId }) => {
    const n = await ctx.db.get("notifications", notificationId);
    if (!n || n.userId !== ctx.viewer.userId) return notFound("Obaveštenje ne postoji.");
    if (!n.read)
      await ctx.db.patch("notifications", notificationId, { read: true, readAt: Date.now() });
    return null;
  },
});

export const markAllRead = userMutation({
  args: {},
  returns: v.object({ marked: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", ctx.viewer.userId).eq("read", false))
      .take(200);
    const now = Date.now();
    for (const n of rows) await ctx.db.patch("notifications", n._id, { read: true, readAt: now });
    return { marked: rows.length };
  },
});

const prefsV = v.object({
  email: v.object({
    orderNew: v.boolean(),
    inquiryNew: v.boolean(),
    mechanicNew: v.boolean(),
    lowStock: v.boolean(),
    reminders: v.boolean(),
    digest: v.boolean(),
  }),
  inApp: v.object({
    orderNew: v.boolean(),
    inquiryNew: v.boolean(),
    mechanicNew: v.boolean(),
    lowStock: v.boolean(),
    reminders: v.boolean(),
  }),
});

const DEFAULT_PREFS = {
  email: {
    orderNew: true,
    inquiryNew: true,
    mechanicNew: true,
    lowStock: true,
    reminders: true,
    digest: true,
  },
  inApp: { orderNew: true, inquiryNew: true, mechanicNew: true, lowStock: true, reminders: true },
};

/** The signed-in staff member's notification preferences (defaults: everything on). */
export const preferences = staffQuery({
  args: {},
  returns: prefsV,
  handler: async (ctx) => {
    const row = await ctx.db
      .query("staffPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .unique();
    return row ? { email: row.email, inApp: row.inApp } : DEFAULT_PREFS;
  },
});

type Prefs = { email: typeof DEFAULT_PREFS.email; inApp: typeof DEFAULT_PREFS.inApp };

async function writePrefs(ctx: MutationCtx, userId: Id<"users">, prefs: Prefs) {
  const row = await ctx.db
    .query("staffPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const now = Date.now();
  if (row) await ctx.db.patch("staffPreferences", row._id, { ...prefs, updatedAt: now });
  else await ctx.db.insert("staffPreferences", { userId, ...prefs, updatedAt: now });
}

export const setPreferences = staffMutation({
  args: prefsV.fields,
  returns: v.null(),
  handler: async (ctx, prefs) => {
    await writePrefs(ctx, ctx.viewer.userId, prefs);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "notifications.preferences",
      entityType: "user",
      entityId: ctx.viewer.userId,
      summary: "Izmenjena podešavanja obaveštenja",
    });
    return null;
  },
});

/** Owner: another staff member's preferences (Korisnici → Obaveštenja). */
export const preferencesFor = ownerQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), prefsV),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user || (user.role !== "staff" && user.role !== "owner")) return null;
    const row = await ctx.db
      .query("staffPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return row ? { email: row.email, inApp: row.inApp } : DEFAULT_PREFS;
  },
});

export const setPreferencesFor = ownerMutation({
  args: { userId: v.id("users"), ...prefsV.fields },
  returns: v.null(),
  handler: async (ctx, { userId, ...prefs }) => {
    const user = await ctx.db.get("users", userId);
    if (!user || (user.role !== "staff" && user.role !== "owner"))
      return notFound("Zaposleni ne postoji.");
    await writePrefs(ctx, userId, prefs);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "notifications.preferences_for",
      entityType: "user",
      entityId: userId,
      summary: `Izmenjena obaveštenja za ${user.email ?? user.name ?? "zaposlenog"}`,
    });
    return null;
  },
});
