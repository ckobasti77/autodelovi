/**
 * The signed-in viewer (header, guards, DAL) and own-profile edits.
 */
import { v } from "convex/values";

import { normalizePhone } from "../lib/format/phone";
import { audit, diffFields } from "./lib/audit";
import { actorOf, getViewer } from "./lib/authz";
import { invalid } from "./lib/errors";
import { publicQuery, userMutation } from "./lib/functions";
import { roleV, userMechanicStatusV } from "./lib/validators";

export const viewer = publicQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      email: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
      firstName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
      phone: v.union(v.string(), v.null()),
      role: roleV,
      isStaff: v.boolean(),
      isOwner: v.boolean(),
      blocked: v.boolean(),
      mechanicStatus: userMechanicStatusV,
      tierName: v.union(v.string(), v.null()),
      creditEnabled: v.boolean(),
      unreadCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    // Blocked users still see who they are (to show the „blokiran“ screen).
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    let tierName: string | null = null;
    if (viewer.mechanic?.status === "approved" && viewer.mechanic.tierId) {
      tierName = (await ctx.db.get("priceTiers", viewer.mechanic.tierId))?.name ?? null;
    }
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", viewer.userId).eq("read", false))
      .take(100);
    const u = viewer.user;
    return {
      userId: viewer.userId,
      email: u.email ?? null,
      name: u.name ?? null,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      phone: u.phoneE164 ?? null,
      role: viewer.role,
      isStaff: viewer.isStaff,
      isOwner: viewer.isOwner,
      blocked: viewer.blocked,
      mechanicStatus: viewer.mechanic?.status ?? ("none" as const),
      tierName,
      creditEnabled: viewer.mechanic?.status === "approved" && viewer.mechanic.creditEnabled,
      unreadCount: unread.length,
    };
  },
});

export const updateMyProfile = userMutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    marketingConsent: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: {
      firstName?: string;
      lastName?: string;
      phoneE164?: string;
      marketingConsent?: boolean;
      name?: string;
    } = {};
    if (args.firstName !== undefined) patch.firstName = args.firstName.trim().slice(0, 60);
    if (args.lastName !== undefined) patch.lastName = args.lastName.trim().slice(0, 60);
    if (args.phone !== undefined) {
      const e164 = normalizePhone(args.phone);
      if (!e164) invalid("Upišite ispravan broj telefona.", "phone");
      patch.phoneE164 = e164;
    }
    if (args.marketingConsent !== undefined) patch.marketingConsent = args.marketingConsent;
    const first = patch.firstName ?? ctx.viewer.user.firstName;
    const last = patch.lastName ?? ctx.viewer.user.lastName;
    if (first || last) patch.name = [first, last].filter(Boolean).join(" ");
    const diff = diffFields(ctx.viewer.user, patch);
    if (diff.length === 0) return null;
    await ctx.db.patch("users", ctx.viewer.userId, patch);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "user.update_profile",
      entityType: "user",
      entityId: ctx.viewer.userId,
      summary: "Korisnik je izmenio svoj profil",
      diff,
    });
    return null;
  },
});
