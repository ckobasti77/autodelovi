/**
 * Audit log viewer (staff).
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
  handler: async (ctx, { entityType, entityId, action, paginationOpts }) => {
    const result =
      entityType && entityId
        ? await ctx.db
            .query("auditLog")
            .withIndex("by_entityType_and_entityId_and_at", (q) =>
              q.eq("entityType", entityType).eq("entityId", entityId),
            )
            .order("desc")
            .paginate(paginationOpts)
        : action
          ? await ctx.db
              .query("auditLog")
              .withIndex("by_action_and_at", (q) => q.eq("action", action))
              .order("desc")
              .paginate(paginationOpts)
          : await ctx.db
              .query("auditLog")
              .withIndex("by_at")
              .order("desc")
              .paginate(paginationOpts);
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
