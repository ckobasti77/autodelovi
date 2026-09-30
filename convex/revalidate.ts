/**
 * Next cache purge channel (ROUTES §B4): catalog, settings and content events POST their
 * cache tags to `<NEXT_SITE_URL>/api/revalidate` (header `x-revalidate-secret`). Skipped when
 * the site URL is local or no `REVALIDATE_SECRET` is set — pages then refresh on their own
 * revalidation windows (5 min – 1 h). Two attempts at most: a missed purge only delays freshness.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { revalidateSecret, siteUrl } from "./lib/env";

const MAX_ATTEMPTS = 2;

/** Cache tags an event invalidates (`lib/server/catalog-cache.ts`), or null. */
export function revalidateTags(
  event: Pick<Doc<"domainEvents">, "type" | "payload">,
): string[] | null {
  const p = event.payload;
  const slug = p.kind === "catalog" ? p.slug : undefined;
  switch (event.type) {
    case "product.changed":
      return ["products", "sitemap", "feeds", ...(slug ? [`product:${slug}`] : [])];
    case "category.changed":
      return ["categories", "sitemap", "landings", ...(slug ? [`category:${slug}`] : [])];
    case "settings.changed":
      return ["settings"];
    case "content.changed":
      return ["faqs", ...(slug ? [`content:${slug}`] : [])];
    default:
      return null;
  }
}

/** True when a purge can reach a deployed site. */
export function revalidateEnabled(): boolean {
  const url = siteUrl();
  return Boolean(revalidateSecret()) && !/^https?:\/\/(localhost|127\.|0\.0\.0\.0)/.test(url);
}

export const job = internalQuery({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.union(v.null(), v.object({ tags: v.array(v.string()), attempts: v.number() })),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get("notificationDeliveries", deliveryId);
    if (!delivery || delivery.channel !== "revalidate" || delivery.status !== "pending")
      return null;
    const event = await ctx.db.get("domainEvents", delivery.eventId);
    const tags = event ? revalidateTags(event) : null;
    return tags ? { tags, attempts: delivery.attempts } : null;
  },
});

export const finish = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    ok: v.boolean(),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { deliveryId, ok, detail }) => {
    const delivery = await ctx.db.get("notificationDeliveries", deliveryId);
    if (!delivery || delivery.status !== "pending") return null;
    const attempts = delivery.attempts + 1;
    if (!ok && attempts < MAX_ATTEMPTS) {
      await ctx.db.patch("notificationDeliveries", deliveryId, {
        attempts,
        lastError: detail?.slice(0, 300),
      });
      await ctx.scheduler.runAfter(60_000, internal.revalidate.send, { deliveryId });
      return null;
    }
    await ctx.db.patch("notificationDeliveries", deliveryId, {
      status: ok ? "sent" : "failed",
      attempts,
      ...(ok ? { sentAt: Date.now() } : { lastError: detail?.slice(0, 300) }),
    });
    return null;
  },
});

export const send = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const job = await ctx.runQuery(internal.revalidate.job, { deliveryId });
    if (!job) return null;
    if (!revalidateEnabled()) {
      await ctx.runMutation(internal.revalidate.finish, {
        deliveryId,
        ok: false,
        detail: "disabled",
      });
      return null;
    }
    try {
      const res = await fetch(`${siteUrl()}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": revalidateSecret() },
        body: JSON.stringify({ tags: job.tags }),
      });
      await ctx.runMutation(internal.revalidate.finish, {
        deliveryId,
        ok: res.ok,
        ...(res.ok ? {} : { detail: `HTTP ${res.status}` }),
      });
    } catch (error) {
      await ctx.runMutation(internal.revalidate.finish, {
        deliveryId,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  },
});
