/**
 * Admin → E-pošta: outbox (filters, message view, resend), delivery configuration, template
 * gallery with live previews and „Pošalji probnu poruku“ (NOTIFICATIONS §I1, step 18).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { emailContext } from "../lib/email/context";
import {
  isTemplateKey,
  renderSample,
  TEMPLATE_KEYS,
  TEMPLATES,
  type TemplateKey,
} from "../lib/email/registry";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { availableModes, resolveEmailConfig } from "./lib/emailConfig";
import { siteUrl } from "./lib/env";
import { invalid, notFound } from "./lib/errors";
import { staffMutation, staffQuery } from "./lib/functions";
import { sendEmail, validRecipients } from "./lib/mailer";
import { enforceRateLimit } from "./lib/rateLimits";
import { getSettings } from "./lib/settings";

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

const modeV = v.union(v.literal("log"), v.literal("test"), v.literal("live"));

/** Secrets never leave the server in clear text, not even to staff (codes, invite links). */
function maskSecrets(templateKey: string, relatedType: string | undefined, text: string): string {
  let out = text;
  if (relatedType === "auth" || templateKey === "password_reset_code")
    out = out.replace(/\b\d{6,8}\b/g, "••••••••");
  if (templateKey === "staff_invite")
    out = out.replace(/(\/admin\/pozivnica\/)[A-Za-z0-9_-]{22,64}/g, "$1••••••••");
  return out;
}

export const outbox = staffQuery({
  args: {
    status: v.optional(statusV),
    templateKey: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("emailLog"),
      to: v.array(v.string()),
      subject: v.string(),
      templateKey: v.string(),
      mode: modeV,
      status: statusV,
      relatedType: v.union(v.string(), v.null()),
      relatedId: v.union(v.string(), v.null()),
      error: v.union(v.string(), v.null()),
      isDemo: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { status, templateKey, paginationOpts }) => {
    const base = templateKey
      ? ctx.db
          .query("emailLog")
          .withIndex("by_templateKey", (q) => q.eq("templateKey", templateKey))
          .order("desc")
      : status
        ? ctx.db
            .query("emailLog")
            .withIndex("by_status", (q) => q.eq("status", status))
            .order("desc")
        : ctx.db.query("emailLog").order("desc");
    // Template is the access path when both are set; status then post-filters (D137).
    const query = templateKey && status ? base.filter((q) => q.eq(q.field("status"), status)) : base;
    const result = await query.paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((m) => ({
        _id: m._id,
        to: m.originalTo ?? m.to,
        subject: m.subject,
        templateKey: m.templateKey,
        mode: m.mode,
        status: m.status,
        relatedType: m.relatedType ?? null,
        relatedId: m.relatedId ?? null,
        error: m.error ?? null,
        isDemo: m.isDemo === true,
        createdAt: m._creationTime,
      })),
    };
  },
});

/** One message with its bodies; auth codes and invite links are masked. */
export const get = staffQuery({
  args: { emailLogId: v.id("emailLog") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("emailLog"),
      to: v.array(v.string()),
      deliveredTo: v.array(v.string()),
      subject: v.string(),
      preheader: v.union(v.string(), v.null()),
      templateKey: v.string(),
      mode: v.string(),
      status: v.string(),
      html: v.union(v.string(), v.null()),
      text: v.string(),
      error: v.union(v.string(), v.null()),
      relatedType: v.union(v.string(), v.null()),
      relatedId: v.union(v.string(), v.null()),
      resendable: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { emailLogId }) => {
    const m = await ctx.db.get("emailLog", emailLogId);
    if (!m) return null;
    const mask = (s: string) => maskSecrets(m.templateKey, m.relatedType, s);
    return {
      _id: m._id,
      to: m.originalTo ?? m.to,
      deliveredTo: m.to,
      subject: m.subject,
      preheader: m.preheader ?? null,
      templateKey: m.templateKey,
      mode: m.mode,
      status: m.status,
      html: m.html ? mask(m.html) : null,
      text: mask(m.text),
      error: m.error ?? null,
      relatedType: m.relatedType ?? null,
      relatedId: m.relatedId ?? null,
      resendable: isResendable(m.templateKey, m.relatedType),
      createdAt: m._creationTime,
      updatedAt: m.updatedAt,
    };
  },
});

function isResendable(templateKey: string, relatedType: string | undefined): boolean {
  // Codes expire and invite links are shown once: those are requested again, not resent.
  return relatedType !== "auth" && templateKey !== "password_reset_code" && templateKey !== "staff_invite";
}

/** Delivery configuration for the outbox banner and the settings switch. */
export const config = staffQuery({
  args: {},
  returns: v.object({
    requested: modeV,
    requestedFrom: v.union(v.literal("settings"), v.literal("env"), v.literal("default")),
    effective: modeV,
    from: v.string(),
    replyTo: v.union(v.string(), v.null()),
    siteUrl: v.string(),
    capabilities: v.object({
      apiKey: v.boolean(),
      webhookSecret: v.boolean(),
      fromAddress: v.boolean(),
      linkSecret: v.boolean(),
    }),
    warnings: v.array(v.string()),
    available: v.object({
      log: v.union(v.string(), v.null()),
      test: v.union(v.string(), v.null()),
      live: v.union(v.string(), v.null()),
    }),
    webhookUrl: v.string(),
  }),
  handler: async (ctx) => {
    const c = resolveEmailConfig(await getSettings(ctx));
    const convexSite = (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
    return {
      requested: c.requested,
      requestedFrom: c.requestedFrom,
      effective: c.effective,
      from: c.from,
      replyTo: c.replyTo,
      siteUrl: c.siteUrl,
      capabilities: c.capabilities,
      warnings: c.warnings,
      available: availableModes(c),
      webhookUrl: convexSite ? `${convexSite}/resend-webhook` : "/resend-webhook",
    };
  },
});

const templateInfoV = v.object({
  key: v.string(),
  label: v.string(),
  group: v.string(),
  trigger: v.string(),
});

export const templates = staffQuery({
  args: {},
  returns: v.array(templateInfoV),
  handler: async () =>
    TEMPLATE_KEYS.map((key) => {
      const t = TEMPLATES[key];
      return { key, label: t.label, group: t.group, trigger: t.trigger };
    }),
});

/** Live preview: the template's sample data with the current settings (company, contacts). */
export const preview = staffQuery({
  args: { key: v.string() },
  returns: v.union(
    v.null(),
    v.object({ subject: v.string(), preheader: v.string(), html: v.string(), text: v.string() }),
  ),
  handler: async (ctx, { key }) => {
    if (!isTemplateKey(key)) return null;
    const settings = await getSettings(ctx);
    return renderSample(key, emailContext(settings, siteUrl()));
  },
});

/** „Pošalji probnu poruku“: the sample of a template to the given (or own) address. */
export const sendTest = staffMutation({
  args: { key: v.string(), to: v.optional(v.string()) },
  returns: v.object({ emailLogId: v.id("emailLog"), mode: modeV, to: v.string() }),
  handler: async (ctx, { key, to }) => {
    if (!isTemplateKey(key)) return notFound("Šablon ne postoji.");
    const target = validRecipients([to ?? ctx.viewer.user.email ?? ""])[0];
    if (!target) invalid("Upišite ispravnu e-mail adresu.", "to");
    await enforceRateLimit(ctx, "emailTest", ctx.viewer.userId);
    const settings = await getSettings(ctx);
    const rendered = renderSample(key as TemplateKey, emailContext(settings, siteUrl()));
    const result = await sendEmail(ctx, settings, {
      to: [target],
      rendered: { ...rendered, subject: `[PROBA] ${rendered.subject}` },
      templateKey: key,
      related: { type: "test" },
    });
    if (!result.emailLogId) invalid("Poruka nije napravljena.");
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "email.test",
      entityType: "emailLog",
      entityId: result.emailLogId,
      summary: `Probna poruka „${TEMPLATES[key as TemplateKey].label}“ na ${target}`,
    });
    return { emailLogId: result.emailLogId, mode: result.mode, to: target };
  },
});

/** Sends a logged or failed message again (same content, original recipients). */
export const resend = staffMutation({
  args: { emailLogId: v.id("emailLog") },
  returns: v.object({ emailLogId: v.id("emailLog"), mode: modeV }),
  handler: async (ctx, { emailLogId }) => {
    const m = await ctx.db.get("emailLog", emailLogId);
    if (!m) return notFound("Poruka ne postoji.");
    if (!isResendable(m.templateKey, m.relatedType))
      invalid("Kodovi i pozivnice se ne šalju ponovo — zatražite novi.");
    const settings = await getSettings(ctx);
    const result = await sendEmail(ctx, settings, {
      to: m.originalTo ?? m.to,
      rendered: { subject: m.subject, preheader: m.preheader ?? "", html: m.html ?? "", text: m.text },
      templateKey: m.templateKey,
      ...(m.relatedType
        ? { related: { type: m.relatedType, ...(m.relatedId ? { id: m.relatedId } : {}) } }
        : {}),
      ...(m.isDemo ? { isDemo: true, forceLog: true } : {}),
      resentFrom: m._id,
    });
    if (!result.emailLogId) invalid(result.ok ? "Poruka nije napravljena." : result.error);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "email.resend",
      entityType: "emailLog",
      entityId: result.emailLogId,
      summary: `Ponovo poslato: ${m.subject}`,
    });
    return { emailLogId: result.emailLogId, mode: result.mode };
  },
});
