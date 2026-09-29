/**
 * „Javi mi kad stigne“ subscriptions (the e-mail is sent in step 18 on `stock.back_in_stock`).
 */
import { v } from "convex/values";

import { isValidEmail, normalizeEmail } from "../lib/domain/identifiers";
import { isAvailableNow } from "../lib/domain/stock";
import { fail, invalid, notFound } from "./lib/errors";
import { publicMutation } from "./lib/functions";
import { enforceRateLimit } from "./lib/rateLimits";
import { getSettings } from "./lib/settings";
import { hashToken, isTokenShape, randomToken } from "./lib/tokens";

export const subscribe = publicMutation({
  args: {
    productId: v.id("products"),
    email: v.string(),
    consent: v.boolean(),
    honeypot: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("subscribed"), v.literal("already"), v.literal("in_stock")),
  }),
  handler: async (ctx, args) => {
    if (args.honeypot.trim() !== "") fail("SPAM", "Prijava nije poslata.");
    const settings = await getSettings(ctx);
    if (!settings.flags.backInStock) fail("DISABLED", "Obaveštenja o dolasku robe su isključena.");
    if (!args.consent) invalid("Potrebna je saglasnost da vam pošaljemo obaveštenje.", "consent");
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) invalid("Upišite ispravnu e-mail adresu.", "email");
    await enforceRateLimit(ctx, "backInStock", ctx.client.key);
    await enforceRateLimit(ctx, "backInStockEmail", email);
    const product = await ctx.db.get("products", args.productId);
    if (!product || !product.active) return notFound("Artikal ne postoji.");
    if (isAvailableNow(product.stockState)) return { status: "in_stock" as const };
    const existing = await ctx.db
      .query("backInStockSubscriptions")
      .withIndex("by_productId_and_status", (q) =>
        q.eq("productId", args.productId).eq("status", "active"),
      )
      .take(500);
    if (existing.some((s) => s.email === email)) return { status: "already" as const };
    await ctx.db.insert("backInStockSubscriptions", {
      productId: args.productId,
      email,
      ...(ctx.viewer ? { userId: ctx.viewer.userId } : {}),
      status: "active",
      // Step 18 issues a fresh unsubscribe token with the notification e-mail.
      unsubscribeTokenHash: await hashToken(randomToken()),
      consentAt: Date.now(),
    });
    return { status: "subscribed" as const };
  },
});

export const unsubscribe = publicMutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token }) => {
    if (!isTokenShape(token)) return { ok: false };
    const tokenHash = await hashToken(token);
    await enforceRateLimit(ctx, "tokenAction", tokenHash);
    const sub = await ctx.db
      .query("backInStockSubscriptions")
      .withIndex("by_unsubscribeTokenHash", (q) => q.eq("unsubscribeTokenHash", tokenHash))
      .unique();
    if (!sub) return { ok: false };
    if (sub.status === "active") {
      await ctx.db.patch("backInStockSubscriptions", sub._id, { status: "cancelled" });
    }
    return { ok: true };
  },
});
