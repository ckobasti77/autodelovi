/**
 * Audit log viewer (staff). Access paths: one entity (type + id), one action, one actor, or
 * the whole log by time; the date range rides on `at` in every index, entity type alone is
 * a post-filter (D137).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { staffQuery } from "./lib/functions";
import { actorV } from "./lib/validators";

export const list = staffQuery({
  args: {
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("auditLog"),
      actor: actorV,
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      summary: v.string(),
      diff: v.union(
        v.array(
          v.object({
            field: v.string(),
            before: v.optional(v.string()),
            after: v.optional(v.string()),
          }),
        ),
        v.null(),
      ),
      at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const from = args.from ?? 0;
    const to = args.to ?? Number.MAX_SAFE_INTEGER;
    const base =
      args.entityType && args.entityId
        ? ctx.db
            .query("auditLog")
            .withIndex("by_entityType_and_entityId_and_at", (q) =>
              q
                .eq("entityType", args.entityType!)
                .eq("entityId", args.entityId!)
                .gte("at", from)
                .lte("at", to),
            )
            .order("desc")
        : args.action
          ? ctx.db
              .query("auditLog")
              .withIndex("by_action_and_at", (q) =>
                q.eq("action", args.action!).gte("at", from).lte("at", to),
              )
              .order("desc")
          : args.actorUserId
            ? ctx.db
                .query("auditLog")
                .withIndex("by_actor_userId_and_at", (q) =>
                  q.eq("actor.userId", args.actorUserId).gte("at", from).lte("at", to),
                )
                .order("desc")
            : ctx.db
                .query("auditLog")
                .withIndex("by_at", (q) => q.gte("at", from).lte("at", to))
                .order("desc");
    const typeOnly = args.entityType && !args.entityId;
    const actorPost = args.actorUserId && (args.action || (args.entityType && args.entityId));
    const query =
      typeOnly || actorPost
        ? base.filter((q) =>
            q.and(
              typeOnly ? q.eq(q.field("entityType"), args.entityType) : true,
              actorPost ? q.eq(q.field("actor.userId"), args.actorUserId) : true,
            ),
          )
        : base;
    const result = await query.paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((a) => ({
        _id: a._id,
        actor: a.actor,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        summary: a.summary,
        diff: a.diff ?? null,
        at: a.at,
      })),
    };
  },
});
