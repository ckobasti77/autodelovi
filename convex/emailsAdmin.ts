/**
 * E-mail outbox viewer (`/admin/mejlovi`). Step 15 ships the list and the message preview;
 * step 18 adds template previews, „Pošalji probni“ and resend on the same `emailLog` rows.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { staffQuery } from "./lib/functions";

const statusV = v.union(
  v.literal("logged"),
  v.literal("queued"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("delivery_delayed"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
  v.literal("opened"),
  v.literal("clicked"),
);

export const outbox = staffQuery({
  args: { status: v.optional(statusV), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("emailLog"),
      to: v.array(v.string()),
      subject: v.string(),
      templateKey: v.string(),
      mode: v.union(v.literal("log"), v.literal("test"), v.literal("live")),
      status: statusV,
      relatedType: v.union(v.string(), v.null()),
      relatedId: v.union(v.string(), v.null()),
      error: v.union(v.string(), v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { status, paginationOpts }) => {
    const result = status
      ? await ctx.db
          .query("emailLog")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db.query("emailLog").order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((m) => ({
        _id: m._id,
        to: m.to,
        subject: m.subject,
        templateKey: m.templateKey,
        mode: m.mode,
        status: m.status,
        relatedType: m.relatedType ?? null,
        relatedId: m.relatedId ?? null,
        error: m.error ?? null,
        createdAt: m._creationTime,
      })),
    };
  },
});

/** One message with its bodies; auth codes are masked (they are secrets even in log mode). */
export const get = staffQuery({
  args: { emailLogId: v.id("emailLog") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("emailLog"),
      to: v.array(v.string()),
      subject: v.string(),
      templateKey: v.string(),
      mode: v.string(),
      status: v.string(),
      html: v.union(v.string(), v.null()),
      text: v.string(),
      error: v.union(v.string(), v.null()),
      relatedType: v.union(v.string(), v.null()),
      relatedId: v.union(v.string(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { emailLogId }) => {
    const m = await ctx.db.get("emailLog", emailLogId);
    if (!m) return null;
    const secret = m.relatedType === "auth";
    const mask = (s: string) => (secret ? s.replace(/\b\d{6,8}\b/g, "••••••••") : s);
    return {
      _id: m._id,
      to: m.to,
      subject: m.subject,
      templateKey: m.templateKey,
      mode: m.mode,
      status: m.status,
      html: m.html ? mask(m.html) : null,
      text: mask(m.text),
      error: m.error ?? null,
      relatedType: m.relatedType ?? null,
      relatedId: m.relatedId ?? null,
      createdAt: m._creationTime,
      updatedAt: m.updatedAt,
    };
  },
});
