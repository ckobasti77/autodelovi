/**
 * Consent log (SEO-ADS §J6, DATA-MODEL `consentRecords`): one row per decision, keyed by the
 * random id from the `sk_consent` cookie — proof of what the visitor chose and when, without
 * storing an IP (only a hash of the user agent). Called from the browser after the choice.
 */
import { v } from "convex/values";

import { CONSENT_POLICY_VERSION } from "../lib/analytics/policy";
import { publicMutation } from "./lib/functions";
import { enforceRateLimit } from "./lib/rateLimits";
import { invalid } from "./lib/errors";
import { sha256Hex } from "./lib/tokens";

export const record = publicMutation({
  args: {
    consentId: v.string(),
    analytics: v.boolean(),
    ads: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!/^[a-z0-9-]{8,64}$/i.test(args.consentId)) invalid("Neispravan zapis saglasnosti.");
    await enforceRateLimit(ctx, "consentLog", ctx.client.key);
    await ctx.db.insert("consentRecords", {
      consentId: args.consentId,
      choices: { analytics: args.analytics, ads: args.ads },
      policyVersion: CONSENT_POLICY_VERSION,
      at: Date.now(),
      ...(ctx.client.userAgent
        ? { uaHash: (await sha256Hex(ctx.client.userAgent)).slice(0, 32) }
        : {}),
      ...(ctx.viewer ? { userId: ctx.viewer.userId } : {}),
    });
    return null;
  },
});
