/**
 * Auth e-mails: the password reset code goes through the template renderer and the mailer
 * (log mode: visible in Admin → E-pošta with the code masked; test/live: sent via Resend).
 * Rate-limited per address (3/h) and globally (60/h); over the limit the code is silently not
 * sent, so the reset form cannot be used to flood an inbox or tell accounts apart.
 */
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { normalizeEmail } from "../lib/domain/identifiers";
import { siteLink, emailContext } from "../lib/email/context";
import { sendTemplateNow } from "./lib/directEmail";
import { siteUrl } from "./lib/env";
import { tryRateLimit } from "./lib/rateLimits";
import { getSettings } from "./lib/settings";

export const sendPasswordResetCode = internalMutation({
  args: { email: v.string(), code: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await tryRateLimit(ctx, "passwordReset", normalizeEmail(args.email)))) return null;
    if (!(await tryRateLimit(ctx, "passwordResetGlobal", "global"))) return null;
    const ectx = emailContext(await getSettings(ctx), siteUrl());
    const result = await sendTemplateNow(
      ctx,
      "password_reset_code",
      {
        code: args.code,
        expiresAt: args.expiresAt,
        resetUrl: siteLink(ectx, "/zaboravljena-lozinka"),
      },
      [args.email],
      { related: { type: "auth" } },
    );
    if (!result.ok && !result.permanent) throw new Error(result.error);
    return null;
  },
});
