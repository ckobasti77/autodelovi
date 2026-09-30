/**
 * E-mail deliveries (NOTIFICATIONS §I1). One `deliverEmail` run per ledger row: load the
 * aggregate, build the template data, render, store in `emailLog` and — outside `log` mode —
 * hand the message to the Resend component. Failures retry with backoff (1 min … 12 h) and
 * stop after 5 attempts (`failed`, visible in Admin → E-pošta). `onEmailEvent` receives
 * delivery feedback from the Resend webhook.
 */
import { vOnEmailEventArgs } from "@convex-dev/resend";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { emailContext, siteLink, adminLink, type EmailContext } from "../lib/email/context";
import type { RenderedEmail } from "../lib/email/html";
import { isTemplateKey, renderTemplate, type TemplateKey } from "../lib/email/registry";
import { workingAge } from "../lib/email/templates/shared";
import { STOCK_STATE_LABEL } from "../lib/i18n/sr/admin";
import { SYSTEM_ACTOR } from "./lib/authz";
import {
  digestData,
  inquiryEmailData,
  mechanicEmailData,
  orderEmailData,
  staffInquiryData,
  staffMechanicData,
  staffOrderData,
} from "./lib/emailData";
import { siteUrl } from "./lib/env";
import { emitEvent } from "./lib/events";
import { sendEmail, type RelatedType } from "./lib/mailer";
import { getSettings } from "./lib/settings";
import type { Settings } from "./lib/settingsSchema";
import { hashToken, randomToken } from "./lib/tokens";
import { MAX_ATTEMPTS, retryDelayMs } from "./events";

type Built =
  | {
      kind: "send";
      to: string[];
      rendered: RenderedEmail;
      related?: { type: RelatedType; id?: string };
      forceLog: boolean;
      isDemo: boolean;
      /** Runs after a successful hand-off (history rows, subscription state). */
      after?: (emailLogId: Id<"emailLog">, mode: "log" | "test" | "live") => Promise<void>;
    }
  | { kind: "skip"; reason: string };

class SkipDelivery extends Error {}

function skip(reason: string): never {
  throw new SkipDelivery(reason);
}

async function orderHistory(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  subject: string,
  mode: "log" | "test" | "live",
) {
  await ctx.db.insert("orderEvents", {
    orderId,
    type: "email_sent",
    message:
      mode === "log"
        ? `E-pošta zabeležena (nije poslata, režim log): ${subject}`
        : `Poslata e-pošta: ${subject}`,
    // The customer sees the notice only when the message really went out.
    visibleToCustomer: mode !== "log",
    actor: SYSTEM_ACTOR,
    at: Date.now(),
  });
}

async function inquiryHistory(
  ctx: MutationCtx,
  inquiryId: Id<"inquiries">,
  subject: string,
  mode: "log" | "test" | "live",
) {
  await ctx.db.insert("inquiryEvents", {
    inquiryId,
    type: "email_sent",
    message:
      mode === "log"
        ? `E-pošta zabeležena (nije poslata, režim log): ${subject}`
        : `Poslata e-pošta: ${subject}`,
    visibleToCustomer: mode !== "log",
    actor: SYSTEM_ACTOR,
    at: Date.now(),
  });
}

function flagsOf(doc: { isDemo?: boolean; isTest?: boolean }) {
  return { isDemo: doc.isDemo === true, forceLog: doc.isDemo === true || doc.isTest === true };
}

async function build(
  ctx: MutationCtx,
  event: Doc<"domainEvents">,
  delivery: Doc<"notificationDeliveries">,
  templateKey: TemplateKey,
  settings: Settings,
  ectx: EmailContext,
): Promise<Built> {
  const p = event.payload;
  const to = [delivery.recipient];
  switch (templateKey) {
    case "order_received":
    case "order_confirmed":
    case "order_backordered":
    case "order_ready_pickup":
    case "order_shipped":
    case "order_delivered":
    case "order_cancelled": {
      if (p.kind !== "order") skip("Pogrešan tip događaja.");
      const order = await ctx.db.get("orders", p.orderId);
      if (!order) skip("Porudžbina ne postoji.");
      const data = await orderEmailData(ctx, order, settings, ectx, templateKey);
      // The delivered template reads the status from the event (preuzeta vs isporučena).
      if (p.to) data.status = p.to;
      const rendered = renderTemplate(templateKey, data, ectx);
      return {
        kind: "send",
        to,
        rendered,
        related: { type: "order", id: order._id },
        ...flagsOf(order),
        after: (_id, mode) => orderHistory(ctx, order._id, rendered.subject, mode),
      };
    }
    case "staff_order_new": {
      if (p.kind !== "order") skip("Pogrešan tip događaja.");
      const order = await ctx.db.get("orders", p.orderId);
      if (!order) skip("Porudžbina ne postoji.");
      return {
        kind: "send",
        to,
        rendered: renderTemplate(
          templateKey,
          await staffOrderData(ctx, order, settings, ectx),
          ectx,
        ),
        related: { type: "order", id: order._id },
        ...flagsOf(order),
      };
    }
    case "inquiry_received":
    case "quote_ready":
    case "quote_expiring": {
      if (p.kind !== "inquiry") skip("Pogrešan tip događaja.");
      const inquiry = await ctx.db.get("inquiries", p.inquiryId);
      if (!inquiry) skip("Upit ne postoji.");
      const quoteId = p.quoteId ?? inquiry.currentQuoteId;
      const quote = quoteId ? await ctx.db.get("quotes", quoteId) : null;
      if (templateKey === "quote_expiring" && quote?.status !== "sent")
        skip("Ponuda više nije aktivna.");
      const data = await inquiryEmailData(
        inquiry,
        templateKey === "inquiry_received" ? null : quote,
        ectx,
        templateKey,
      );
      const rendered = renderTemplate(templateKey, data, ectx);
      return {
        kind: "send",
        to,
        rendered,
        related: { type: "inquiry", id: inquiry._id },
        ...flagsOf(inquiry),
        after: (_id, mode) => inquiryHistory(ctx, inquiry._id, rendered.subject, mode),
      };
    }
    case "staff_inquiry_new": {
      if (p.kind !== "inquiry") skip("Pogrešan tip događaja.");
      const inquiry = await ctx.db.get("inquiries", p.inquiryId);
      if (!inquiry) skip("Upit ne postoji.");
      return {
        kind: "send",
        to,
        rendered: renderTemplate(templateKey, await staffInquiryData(ctx, inquiry, ectx), ectx),
        related: { type: "inquiry", id: inquiry._id },
        ...flagsOf(inquiry),
      };
    }
    case "staff_quote_accepted":
    case "staff_quote_renewal": {
      if (p.kind !== "inquiry") skip("Pogrešan tip događaja.");
      const inquiry = await ctx.db.get("inquiries", p.inquiryId);
      if (!inquiry) skip("Upit ne postoji.");
      const order = p.orderId ? await ctx.db.get("orders", p.orderId) : null;
      return {
        kind: "send",
        to,
        rendered: renderTemplate(
          templateKey,
          {
            number: inquiry.number,
            adminUrl: order
              ? adminLink(ectx, `/admin/porudzbine/${order.number}`)
              : adminLink(ectx, `/admin/upiti/${inquiry.number}`),
            customerName: inquiry.contact.name,
            ...(order ? { orderNumber: order.number, totalPara: order.totals.totalPara } : {}),
          },
          ectx,
        ),
        related: { type: "inquiry", id: inquiry._id },
        ...flagsOf(inquiry),
      };
    }
    case "mechanic_registration_received":
    case "mechanic_approved":
    case "mechanic_rejected":
    case "mechanic_suspended": {
      if (p.kind !== "mechanic") skip("Pogrešan tip događaja.");
      const profile = await ctx.db.get("mechanicProfiles", p.profileId);
      if (!profile) skip("Profil majstora ne postoji.");
      const data = await mechanicEmailData(ctx, profile, ectx, templateKey, p.reason);
      return {
        kind: "send",
        to,
        rendered: renderTemplate(templateKey, data, ectx),
        related: { type: "mechanic", id: profile._id },
        isDemo: profile.isDemo,
        forceLog: profile.isDemo,
      };
    }
    case "staff_mechanic_new": {
      if (p.kind !== "mechanic") skip("Pogrešan tip događaja.");
      const profile = await ctx.db.get("mechanicProfiles", p.profileId);
      if (!profile) skip("Profil majstora ne postoji.");
      return {
        kind: "send",
        to,
        rendered: renderTemplate(templateKey, staffMechanicData(profile, ectx), ectx),
        related: { type: "mechanic", id: profile._id },
        isDemo: profile.isDemo,
        forceLog: profile.isDemo,
      };
    }
    case "back_in_stock": {
      if (p.kind !== "stock") skip("Pogrešan tip događaja.");
      const subId = delivery.recipient.replace(/^sub:/, "") as Id<"backInStockSubscriptions">;
      const sub = await ctx.db.get("backInStockSubscriptions", subId);
      if (!sub || sub.status !== "active") skip("Prijava više nije aktivna.");
      const product = await ctx.db.get("products", p.productId);
      if (!product || !product.active) skip("Artikal nije aktivan.");
      if (product.stockState !== "in_stock" && product.stockState !== "low_stock")
        skip("Artikal je ponovo bez zaliha.");
      // A fresh unsubscribe token goes out with the message (only its hash is stored).
      const token = randomToken();
      await ctx.db.patch("backInStockSubscriptions", sub._id, {
        unsubscribeTokenHash: await hashToken(token),
      });
      const rendered = renderTemplate(
        templateKey,
        {
          productName: product.name,
          sku: product.sku,
          manufacturer: product.manufacturerName,
          pricePara: product.retailPricePara,
          stockLabel: STOCK_STATE_LABEL[product.stockState],
          productUrl: siteLink(ectx, `/deo/${product.slug}`, templateKey),
          unsubscribeUrl: siteLink(ectx, `/obavestenja/odjava/${token}`),
        },
        ectx,
      );
      return {
        kind: "send",
        to: [sub.email],
        rendered,
        related: { type: "product", id: product._id },
        isDemo: sub.isDemo === true || product.isDemo,
        forceLog: sub.isDemo === true,
        after: async () => {
          await ctx.db.patch("backInStockSubscriptions", sub._id, {
            status: "notified",
            notifiedAt: Date.now(),
          });
        },
      };
    }
    case "staff_low_stock": {
      if (p.kind !== "stock_batch") skip("Pogrešan tip događaja.");
      return {
        kind: "send",
        to,
        rendered: renderTemplate(
          templateKey,
          {
            items: p.items.map((i) => ({
              sku: i.sku,
              name: i.name,
              qty: i.qty,
              url: adminLink(ectx, `/admin/proizvodi/${i.productId}`),
            })),
            total: p.total,
            adminUrl: adminLink(ectx, "/admin/lager"),
          },
          ectx,
        ),
        related: { type: "product" },
        isDemo: false,
        forceLog: false,
      };
    }
    case "staff_daily_digest": {
      if (p.kind !== "digest") skip("Pogrešan tip događaja.");
      return {
        kind: "send",
        to,
        rendered: renderTemplate(
          templateKey,
          await digestData(ctx, p.day, event._creationTime, settings, ectx),
          ectx,
        ),
        related: { type: "digest", id: p.day },
        isDemo: false,
        forceLog: false,
      };
    }
    case "staff_reminder": {
      if (p.kind !== "reminder") skip("Pogrešan tip događaja.");
      const doc =
        p.target === "order" && p.orderId
          ? await ctx.db.get("orders", p.orderId)
          : p.inquiryId
            ? await ctx.db.get("inquiries", p.inquiryId)
            : null;
      if (!doc) skip("Dokument ne postoji.");
      const customerName =
        "contact" in doc && "firstName" in doc.contact
          ? `${doc.contact.firstName} ${doc.contact.lastName}`.trim()
          : (doc.contact as { name: string }).name;
      return {
        kind: "send",
        to,
        rendered: renderTemplate(
          templateKey,
          {
            target: p.target,
            number: p.number,
            level: p.level,
            ageLabel: workingAge(p.workingMinutes),
            customerName,
            url: adminLink(
              ectx,
              p.target === "order" ? `/admin/porudzbine/${p.number}` : `/admin/upiti/${p.number}`,
            ),
          },
          ectx,
        ),
        related: { type: p.target, id: p.target === "order" ? p.orderId : p.inquiryId },
        ...flagsOf(doc),
      };
    }
    default:
      return { kind: "skip", reason: `Šablon ${templateKey} se ne šalje iz događaja.` };
  }
}

export const deliverEmail = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get("notificationDeliveries", deliveryId);
    if (!delivery || delivery.channel !== "email") return null;
    if (delivery.status === "sent" || delivery.status === "skipped") return null;
    if (delivery.status === "failed" && delivery.attempts >= MAX_ATTEMPTS) return null;
    const event = await ctx.db.get("domainEvents", delivery.eventId);
    const attempts = delivery.attempts + 1;
    const templateKey = delivery.templateKey;
    if (!event || !templateKey || !isTemplateKey(templateKey)) {
      await ctx.db.patch("notificationDeliveries", deliveryId, {
        status: "skipped",
        attempts,
        lastError: "Događaj ili šablon ne postoji.",
      });
      return null;
    }
    const settings = await getSettings(ctx);
    const ectx = emailContext(settings, siteUrl());

    let built: Built;
    try {
      built = await build(ctx, event, delivery, templateKey, settings, ectx);
    } catch (error) {
      if (error instanceof SkipDelivery) {
        await ctx.db.patch("notificationDeliveries", deliveryId, {
          status: "skipped",
          attempts,
          lastError: error.message,
        });
        return null;
      }
      await failDelivery(ctx, delivery, attempts, error);
      return null;
    }
    if (built.kind === "skip") {
      await ctx.db.patch("notificationDeliveries", deliveryId, {
        status: "skipped",
        attempts,
        lastError: built.reason,
      });
      return null;
    }
    const result = await sendEmail(ctx, settings, {
      to: built.to,
      rendered: built.rendered,
      templateKey,
      eventId: event._id,
      ...(built.related ? { related: built.related } : {}),
      forceLog: built.forceLog,
      isDemo: built.isDemo,
      idempotencyKey: `${event._id}:${delivery.recipient}`,
      ...(delivery.emailLogId ? { existingLogId: delivery.emailLogId } : {}),
    });
    if (!result.ok) {
      if (result.permanent) {
        await ctx.db.patch("notificationDeliveries", deliveryId, {
          status: "skipped",
          attempts,
          lastError: result.error,
        });
        return null;
      }
      await failDelivery(ctx, delivery, attempts, new Error(result.error), result.emailLogId);
      return null;
    }
    if (built.after) await built.after(result.emailLogId, result.mode);
    await ctx.db.patch("notificationDeliveries", deliveryId, {
      status: "sent",
      attempts,
      sentAt: Date.now(),
      emailLogId: result.emailLogId,
      providerRef: result.emailLogId,
      lastError: undefined,
      nextAttemptAt: undefined,
    });
    return null;
  },
});

async function failDelivery(
  ctx: MutationCtx,
  delivery: Doc<"notificationDeliveries">,
  attempts: number,
  error: unknown,
  emailLogId?: Id<"emailLog"> | null,
) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  const final = attempts >= MAX_ATTEMPTS;
  const nextAttemptAt = final ? undefined : Date.now() + retryDelayMs(attempts);
  await ctx.db.patch("notificationDeliveries", delivery._id, {
    status: "failed",
    attempts,
    lastError: message,
    nextAttemptAt,
    ...(emailLogId ? { emailLogId } : {}),
  });
  if (!final) {
    await ctx.scheduler.runAfter(retryDelayMs(attempts), internal.notify.deliverEmail, {
      deliveryId: delivery._id,
    });
  }
}

// Resend webhook feedback ----------------------------------------------------------------

type LogStatus = Doc<"emailLog">["status"];

const EVENT_STATUS: Record<string, LogStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "failed",
};

/** Progress order; terminal problems (bounced, complained, failed) always win. */
const RANK: Record<LogStatus, number> = {
  logged: 0,
  queued: 1,
  sent: 2,
  delivery_delayed: 3,
  delivered: 4,
  opened: 5,
  clicked: 6,
  failed: 10,
  bounced: 10,
  complained: 10,
};

/** Next status for a log row, or null when the event would move it backwards. */
export function nextLogStatus(current: LogStatus, incoming: LogStatus): LogStatus | null {
  if (current === incoming) return null;
  if (RANK[current] >= 10) return null;
  if (RANK[incoming] >= 10) return incoming;
  return RANK[incoming] > RANK[current] ? incoming : null;
}

export const onEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  returns: v.null(),
  handler: async (ctx, { id, event }) => {
    const log = await ctx.db
      .query("emailLog")
      .withIndex("by_resendEmailId", (q) => q.eq("resendEmailId", id))
      .unique();
    if (!log) return null;
    const incoming = EVENT_STATUS[event.type];
    if (!incoming) return null;
    const next = nextLogStatus(log.status, incoming);
    if (!next) return null;
    const reason =
      event.type === "email.bounced" ? event.data.bounce.message.slice(0, 300) : undefined;
    await ctx.db.patch("emailLog", log._id, {
      status: next,
      ...(reason ? { error: reason } : {}),
      updatedAt: Date.now(),
    });
    if (next !== "bounced" && next !== "complained") return null;

    // Flag it for staff (in-app) and in the related record's history.
    let href: string | undefined;
    if (log.relatedType === "order" && log.relatedId) {
      const order = await ctx.db.get("orders", log.relatedId as Id<"orders">);
      if (order) {
        href = `/admin/porudzbine/${order.number}`;
        await ctx.db.insert("orderEvents", {
          orderId: order._id,
          type: "email_failed",
          message: `E-pošta ${next === "bounced" ? "nije isporučena" : "prijavljena kao neželjena"}: ${log.subject}`,
          visibleToCustomer: false,
          actor: SYSTEM_ACTOR,
          at: Date.now(),
        });
      }
    } else if (log.relatedType === "inquiry" && log.relatedId) {
      const inquiry = await ctx.db.get("inquiries", log.relatedId as Id<"inquiries">);
      if (inquiry) href = `/admin/upiti/${inquiry.number}`;
    } else if (log.relatedType === "mechanic" && log.relatedId) {
      href = `/admin/majstori/${log.relatedId}`;
    }
    const to = log.originalTo?.[0] ?? log.to[0] ?? "";
    await emitEvent(ctx, {
      type: next === "bounced" ? "email.bounced" : "email.complained",
      aggregateType: "system",
      aggregateId: log._id,
      payload: {
        kind: "email",
        emailLogId: log._id,
        to,
        subject: log.subject,
        ...(log.relatedType ? { relatedType: log.relatedType } : {}),
        ...(log.relatedId ? { relatedId: log.relatedId } : {}),
        ...(href ? { href } : {}),
        ...(reason ? { reason } : {}),
      },
      dedupeKey: `${next === "bounced" ? "email.bounced" : "email.complained"}:${log._id}`,
      actor: SYSTEM_ACTOR,
    });
    return null;
  },
});
