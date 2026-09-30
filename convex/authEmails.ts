/**
 * Auth e-mails: the password reset code goes through the template renderer and the mailer
 * (log mode: visible in Admin → E-pošta with the code masked; test/live: sent via Resend).
 */
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { siteLink, emailContext } from "../lib/email/context";
import { sendTemplateNow } from "./lib/directEmail";
import { siteUrl } from "./lib/env";
import { getSettings } from "./lib/settings";

export const sendPasswordResetCode = internalMutation({
  args: { email: v.string(), code: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
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
