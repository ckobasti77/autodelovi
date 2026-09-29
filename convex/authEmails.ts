/**
 * Auth e-mails. Until step 18 wires the renderer and Resend, codes are written to
 * `emailLog` in `log` mode so the owner sees them in Admin → Mejlovi (HUMAN-TODO §4).
 */
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { formatBelgradeDateTime } from "../lib/domain/time";

export const logPasswordResetCode = internalMutation({
  args: { email: v.string(), code: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("emailLog", {
      to: [args.email],
      subject: "Kod za novu lozinku",
      templateKey: "password_reset_code",
      text: [
        "Zatražena je nova lozinka za vaš nalog.",
        `Kod: ${args.code}`,
        `Kod važi 15 minuta (do ${formatBelgradeDateTime(args.expiresAt)}).`,
        "Ako niste vi tražili promenu, ignorišite ovu poruku.",
      ].join("\n"),
      mode: "log",
      status: "logged",
      relatedType: "auth",
      updatedAt: now,
    });
    return null;
  },
});
