/**
 * In-app notifications (bell) for the signed-in user.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { notFound } from "./lib/errors";
import { userMutation, userQuery } from "./lib/functions";

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
