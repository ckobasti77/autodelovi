/**
 * Meta Conversions API channel (SEO-ADS §J7). The dispatcher writes a `meta_capi` ledger row
 * for `order.created` (Purchase), `inquiry.created` (Lead) and `mechanic.registered`
 * (CompleteRegistration) when the owner enabled CAPI, a Pixel id and `META_CAPI_TOKEN`
 * exist and the visitor granted ads cookies; `send` builds the hashed payload
 * (`lib/analytics/capi.ts`) and posts it to the Graph API with the browser's event id, so Meta
 * counts the conversion once. Failures retry (1 min … 12 h, 5 attempts).
 */
import { v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { buildCapiEvent, capiRequestBody, capiUrl, fbcFromClick } from "../lib/analytics/capi";
import { metaCapiToken, siteUrl } from "./lib/env";
import { getSettings } from "./lib/settings";
import { MAX_ATTEMPTS, retryDelayMs } from "./events";

const REQUEST_TIMEOUT_MS = 10_000;

const userV = v.object({
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  city: v.optional(v.string()),
  externalId: v.optional(v.string()),
  ip: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  fbp: v.optional(v.string()),
  fbc: v.optional(v.string()),
});

const capiInputV = v.object({
  eventName: v.union(v.literal("Purchase"), v.literal("Lead"), v.literal("CompleteRegistration")),
  eventId: v.string(),
  eventTimeMs: v.number(),
  eventSourceUrl: v.string(),
  user: userV,
  custom: v.object({
    valuePara: v.optional(v.number()),
    contents: v.optional(
      v.array(v.object({ id: v.string(), quantity: v.number(), itemPricePara: v.number() })),
    ),
    orderId: v.optional(v.string()),
    contentName: v.optional(v.string()),
    status: v.optional(v.string()),
  }),
});

type CapiJobInput = Infer<typeof capiInputV>;

type Attribution = NonNullable<Doc<"orders">["attribution"]>;

function clickIds(a: Attribution | undefined) {
  const touch = a?.last ?? a?.first;
  const fbc = a?.fbc ?? fbcFromClick(touch?.fbclid, touch?.at) ?? undefined;
  return { ...(a?.fbp ? { fbp: a.fbp } : {}), ...(fbc ? { fbc } : {}) };
}

const splitName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { firstName: first ?? "", lastName: rest.join(" ") };
};

function context(event: Doc<"domainEvents">, path: string) {
  return {
    ip: event.capiContext?.ip,
    userAgent: event.capiContext?.userAgent,
    eventSourceUrl: event.capiContext?.eventSourceUrl || `${siteUrl()}${path}`,
  };
}

/** Builds the CAPI input for an event, or the reason it must not be sent. */
async function inputFor(
  ctx: QueryCtx,
  event: Doc<"domainEvents">,
): Promise<{ input: CapiJobInput } | { skip: string }> {
  const p = event.payload;
  if (event.type === "order.created" && p.kind === "order") {
    const order = await ctx.db.get("orders", p.orderId);
    if (!order) return { skip: "order_missing" };
    if (order.isDemo || order.isTest) return { skip: "demo_or_test" };
    if (!order.attribution?.consentAds) return { skip: "no_ads_consent" };
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .take(200);
    const c = context(event, "/porudzbina");
    return {
      input: {
        eventName: "Purchase",
        eventId: order.number,
        eventTimeMs: order._creationTime,
        eventSourceUrl: c.eventSourceUrl,
        user: {
          email: order.contact.email,
          phone: order.contact.phone,
          firstName: order.contact.firstName,
          lastName: order.contact.lastName,
          ...(order.delivery.address?.city ? { city: order.delivery.address.city } : {}),
          ...(order.userId ? { externalId: order.userId } : {}),
          ...(c.ip ? { ip: c.ip } : {}),
          ...(c.userAgent ? { userAgent: c.userAgent } : {}),
          ...clickIds(order.attribution),
        },
        custom: {
          valuePara: order.totals.totalPara,
          contents: items.map((i) => ({
            id: i.sku,
            quantity: i.quantity,
            itemPricePara: i.unitPricePara,
          })),
          orderId: order.number,
        },
      },
    };
  }
  if (event.type === "inquiry.created" && p.kind === "inquiry") {
    const inquiry = await ctx.db.get("inquiries", p.inquiryId);
    if (!inquiry) return { skip: "inquiry_missing" };
    if (inquiry.isDemo || inquiry.isTest) return { skip: "demo_or_test" };
    if (!inquiry.attribution?.consentAds) return { skip: "no_ads_consent" };
    const c = context(event, "/upit");
    const name = splitName(inquiry.contact.name);
    return {
      input: {
        eventName: "Lead",
        eventId: inquiry.number,
        eventTimeMs: inquiry._creationTime,
        eventSourceUrl: c.eventSourceUrl,
        user: {
          ...(inquiry.contact.email ? { email: inquiry.contact.email } : {}),
          ...(inquiry.contact.phone ? { phone: inquiry.contact.phone } : {}),
          ...(name.firstName ? { firstName: name.firstName } : {}),
          ...(name.lastName ? { lastName: name.lastName } : {}),
          ...(inquiry.userId ? { externalId: inquiry.userId } : {}),
          ...(c.ip ? { ip: c.ip } : {}),
          ...(c.userAgent ? { userAgent: c.userAgent } : {}),
          ...clickIds(inquiry.attribution),
        },
        custom: { contentName: "Upit za deo" },
      },
    };
  }
  if (event.type === "mechanic.registered" && p.kind === "mechanic") {
    const profile = await ctx.db.get("mechanicProfiles", p.profileId);
    if (!profile) return { skip: "profile_missing" };
    if (profile.isDemo) return { skip: "demo_or_test" };
    const user = await ctx.db.get("users", profile.userId);
    if (user?.isTest) return { skip: "demo_or_test" };
    if (!profile.attribution?.consentAds) return { skip: "no_ads_consent" };
    const c = context(event, "/za-majstore/registracija");
    const name = splitName(profile.contactPerson);
    return {
      input: {
        eventName: "CompleteRegistration",
        eventId: `mech-${profile._id}`,
        eventTimeMs: profile._creationTime,
        eventSourceUrl: c.eventSourceUrl,
        user: {
          email: profile.email,
          phone: profile.phone,
          ...(name.firstName ? { firstName: name.firstName } : {}),
          ...(name.lastName ? { lastName: name.lastName } : {}),
          city: profile.city,
          externalId: profile.userId,
          ...(c.ip ? { ip: c.ip } : {}),
          ...(c.userAgent ? { userAgent: c.userAgent } : {}),
          ...clickIds(profile.attribution),
        },
        custom: { contentName: "Registracija majstora", status: "pending" },
      },
    };
  }
  return { skip: "unsupported_event" };
}

export const job = internalQuery({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.union(
    v.object({ kind: v.literal("skip"), reason: v.string() }),
    v.object({
      kind: v.literal("send"),
      pixelId: v.string(),
      testEventCode: v.union(v.string(), v.null()),
      input: capiInputV,
    }),
  ),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get("notificationDeliveries", deliveryId);
    if (!delivery || delivery.channel !== "meta_capi" || delivery.status === "sent") {
      return { kind: "skip" as const, reason: "not_pending" };
    }
    const event = await ctx.db.get("domainEvents", delivery.eventId);
    if (!event) return { kind: "skip" as const, reason: "event_missing" };
    const tracking = (await getSettings(ctx)).tracking;
    const pixelId = tracking.metaPixelId?.trim();
    if (!tracking.metaCapiEnabled || !pixelId) return { kind: "skip" as const, reason: "disabled" };
    const built = await inputFor(ctx, event);
    if ("skip" in built) return { kind: "skip" as const, reason: built.skip };
    return {
      kind: "send" as const,
      pixelId,
      testEventCode: tracking.metaTestEventCode?.trim() || null,
      input: built.input,
    };
  },
});

export const finish = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    outcome: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { deliveryId, outcome, detail }) => {
    const delivery = await ctx.db.get("notificationDeliveries", deliveryId);
    if (!delivery || delivery.status === "sent") return null;
    const attempts = delivery.attempts + 1;
    if (outcome === "failed" && attempts < MAX_ATTEMPTS) {
      const nextAttemptAt = Date.now() + retryDelayMs(attempts);
      await ctx.db.patch("notificationDeliveries", deliveryId, {
        status: "pending",
        attempts,
        lastError: detail?.slice(0, 500),
        nextAttemptAt,
      });
      await ctx.scheduler.runAt(nextAttemptAt, internal.capi.send, { deliveryId });
      return null;
    }
    await ctx.db.patch("notificationDeliveries", deliveryId, {
      status: outcome,
      attempts,
      ...(outcome === "sent"
        ? {
            sentAt: Date.now(),
            lastError: undefined,
            ...(detail ? { providerRef: detail.slice(0, 200) } : {}),
          }
        : { lastError: detail?.slice(0, 500) }),
    });
    // The send is final: the visitor's IP and user agent are no longer needed (SECURITY §L5).
    const event = await ctx.db.get("domainEvents", delivery.eventId);
    if (event?.capiContext) {
      await ctx.db.patch("domainEvents", event._id, { capiContext: undefined });
    }
    return null;
  },
});

export const send = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const job = await ctx.runQuery(internal.capi.job, { deliveryId });
    if (job.kind === "skip") {
      if (job.reason !== "not_pending") {
        await ctx.runMutation(internal.capi.finish, {
          deliveryId,
          outcome: "skipped",
          detail: job.reason,
        });
      }
      return null;
    }
    const token = metaCapiToken();
    if (!token) {
      await ctx.runMutation(internal.capi.finish, {
        deliveryId,
        outcome: "skipped",
        detail: "no_token",
      });
      return null;
    }
    const event = await buildCapiEvent(job.input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${capiUrl(job.pixelId)}?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(capiRequestBody([event], job.testEventCode)),
        signal: controller.signal,
      });
      const text = await res.text();
      if (res.ok) {
        let ref = "";
        try {
          const json = JSON.parse(text) as { events_received?: number; fbtrace_id?: string };
          ref = `received=${json.events_received ?? "?"} trace=${json.fbtrace_id ?? ""}`;
        } catch {
          ref = "ok";
        }
        await ctx.runMutation(internal.capi.finish, { deliveryId, outcome: "sent", detail: ref });
      } else {
        await ctx.runMutation(internal.capi.finish, {
          deliveryId,
          outcome: "failed",
          detail: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.capi.finish, {
        deliveryId,
        outcome: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
    return null;
  },
});
