/**
 * Staff mechanic approvals (docs/DATA-MODEL.md §C7 mechanic states): pending → approved |
 * rejected; approved ⇄ suspended; rejected → pending. Each change updates
 * `users.mechanicStatus`, emits `mechanic.*` and is audited (`convex/lib/mechanics.ts`).
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { classifyAttribution } from "../lib/domain/attribution";
import { audit, diffFields } from "./lib/audit";
import { actorOf, type Viewer } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import {
  approveMechanic,
  assertCreditLimit,
  changeMechanicStatus,
  clampPaymentTerms,
  creditStatus,
  validatePersonalRules,
} from "./lib/mechanics";
import { staffMutation, staffQuery } from "./lib/functions";
import { attributionV, mechanicStatusV, personalRulesV, serviceTypeV } from "./lib/validators";

const rowV = v.object({
  _id: v.id("mechanicProfiles"),
  userId: v.id("users"),
  status: mechanicStatusV,
  companyName: v.string(),
  pib: v.string(),
  city: v.string(),
  contactPerson: v.string(),
  phone: v.string(),
  email: v.string(),
  tierId: v.union(v.id("priceTiers"), v.null()),
  creditEnabled: v.boolean(),
  createdAt: v.number(),
  reviewedAt: v.union(v.number(), v.null()),
  /** Traffic source (lib/domain/attribution): channel key + utm_campaign. */
  channel: v.string(),
  campaign: v.union(v.string(), v.null()),
  isDemo: v.boolean(),
});

const toRow = (p: Doc<"mechanicProfiles">) => ({
  _id: p._id,
  userId: p.userId,
  status: p.status,
  companyName: p.companyName,
  pib: p.pib,
  city: p.city,
  contactPerson: p.contactPerson,
  phone: p.phone,
  email: p.email,
  tierId: p.tierId ?? null,
  creditEnabled: p.creditEnabled,
  createdAt: p._creationTime,
  reviewedAt: p.reviewedAt ?? null,
  ...sourceOf(p.attribution),
  isDemo: p.isDemo,
});

function sourceOf(a: Doc<"mechanicProfiles">["attribution"]) {
  const info = classifyAttribution(a);
  return { channel: info.channel, campaign: info.campaign || null };
}

const LIST_LIMIT = 200;

export const list = staffQuery({
  args: {
    status: v.optional(mechanicStatusV),
    /** Channel key (`google_ads`, `meta_ads`, …) or a utm_campaign value. */
    source: v.optional(v.string()),
  },
  returns: v.array(rowV),
  handler: async (ctx, { status, source }) => {
    const rows = status
      ? await ctx.db
          .query("mechanicProfiles")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(LIST_LIMIT)
      : await ctx.db.query("mechanicProfiles").order("desc").take(LIST_LIMIT);
    const mapped = rows.map(toRow);
    return source ? mapped.filter((r) => r.channel === source || r.campaign === source) : mapped;
  },
});

/** Per-status counts for the staff tabs (bounded per status). */
export const counts = staffQuery({
  args: {},
  returns: v.object({
    pending: v.number(),
    approved: v.number(),
    rejected: v.number(),
    suspended: v.number(),
  }),
  handler: async (ctx) => {
    const count = async (status: Doc<"mechanicProfiles">["status"]) =>
      (
        await ctx.db
          .query("mechanicProfiles")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(LIST_LIMIT)
      ).length;
    return {
      pending: await count("pending"),
      approved: await count("approved"),
      rejected: await count("rejected"),
      suspended: await count("suspended"),
    };
  },
});

export const get = staffQuery({
  args: { profileId: v.id("mechanicProfiles") },
  returns: v.union(
    v.null(),
    v.object({
      profile: rowV,
      mb: v.string(),
      address: v.string(),
      serviceTypes: v.array(serviceTypeV),
      brandsServiced: v.array(v.id("vehicleBrands")),
      brandNames: v.array(v.string()),
      personalRules: v.union(personalRulesV, v.null()),
      creditLimitPara: v.union(v.number(), v.null()),
      paymentTermsDays: v.number(),
      internalNote: v.union(v.string(), v.null()),
      rejectionReason: v.union(v.string(), v.null()),
      attribution: v.union(attributionV, v.null()),
      userEmail: v.union(v.string(), v.null()),
      tierName: v.union(v.string(), v.null()),
      credit: v.object({ usedPara: v.number(), openCount: v.number() }),
      orderCount: v.number(),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    const p = await ctx.db.get("mechanicProfiles", profileId);
    if (!p) return null;
    const user = await ctx.db.get("users", p.userId);
    const brandNames: string[] = [];
    for (const id of p.brandsServiced) {
      const brand = await ctx.db.get("vehicleBrands", id);
      if (brand) brandNames.push(brand.name);
    }
    const tier = p.tierId ? await ctx.db.get("priceTiers", p.tierId) : null;
    const credit = await creditStatus(ctx, p);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_mechanicProfileId", (q) => q.eq("mechanicProfileId", p._id))
      .take(500);
    return {
      profile: toRow(p),
      mb: p.mb,
      address: p.address,
      serviceTypes: p.serviceTypes,
      brandsServiced: p.brandsServiced,
      brandNames,
      personalRules: p.personalRules ?? null,
      creditLimitPara: p.creditLimitPara ?? null,
      paymentTermsDays: p.paymentTermsDays,
      internalNote: p.internalNote ?? null,
      rejectionReason: p.rejectionReason ?? null,
      attribution: p.attribution ?? null,
      userEmail: user?.email ?? null,
      tierName: tier?.name ?? null,
      credit: { usedPara: credit.usedPara, openCount: credit.openCount },
      orderCount: orders.length,
    };
  },
});

/**
 * Staff may not grant themselves mechanic prices or credit: approving, reactivating or
 * changing the terms of one's own profile is left to the owner.
 */
async function assertNotOwnProfile(
  ctx: QueryCtx & { viewer: Viewer },
  profileId: Id<"mechanicProfiles">,
): Promise<void> {
  if (ctx.viewer.isOwner) return;
  const profile = await ctx.db.get("mechanicProfiles", profileId);
  if (profile && profile.userId === ctx.viewer.userId) {
    fail("FORBIDDEN", "Svoj profil majstora ne možete odobriti ni menjati. To radi vlasnik.");
  }
}

export const approve = staffMutation({
  args: {
    profileId: v.id("mechanicProfiles"),
    tierId: v.id("priceTiers"),
    personalRules: v.optional(personalRulesV),
    creditEnabled: v.boolean(),
    creditLimitPara: v.optional(v.number()),
    paymentTermsDays: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertNotOwnProfile(ctx, args.profileId);
    await approveMechanic(ctx, actorOf(ctx.viewer), ctx.viewer.userId, args);
    return null;
  },
});

export const reject = staffMutation({
  args: { profileId: v.id("mechanicProfiles"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { profileId, reason }) => {
    const text = reason.trim().slice(0, 500);
    if (text.length < 3) invalid("Upišite razlog.", "reason");
    await changeMechanicStatus(ctx, {
      actor: actorOf(ctx.viewer),
      reviewerId: ctx.viewer.userId,
      profileId,
      to: "rejected",
      patch: { rejectionReason: text },
      reason: text,
    });
    return null;
  },
});

export const suspend = staffMutation({
  args: { profileId: v.id("mechanicProfiles"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { profileId, reason }) => {
    const text = reason?.trim().slice(0, 500);
    await changeMechanicStatus(ctx, {
      actor: actorOf(ctx.viewer),
      reviewerId: ctx.viewer.userId,
      profileId,
      to: "suspended",
      patch: {},
      ...(text ? { reason: text } : {}),
    });
    return null;
  },
});

export const reactivate = staffMutation({
  args: { profileId: v.id("mechanicProfiles") },
  returns: v.null(),
  handler: async (ctx, { profileId }) => {
    await assertNotOwnProfile(ctx, profileId);
    const profile = await ctx.db.get("mechanicProfiles", profileId);
    if (!profile) return notFound("Profil majstora ne postoji.");
    const tier = profile.tierId ? await ctx.db.get("priceTiers", profile.tierId) : null;
    await changeMechanicStatus(ctx, {
      actor: actorOf(ctx.viewer),
      reviewerId: ctx.viewer.userId,
      profileId,
      to: "approved",
      patch: {},
      ...(tier ? { tierName: tier.name } : {}),
    });
    return null;
  },
});

export const reopen = staffMutation({
  args: { profileId: v.id("mechanicProfiles") },
  returns: v.null(),
  handler: async (ctx, { profileId }) => {
    await changeMechanicStatus(ctx, {
      actor: actorOf(ctx.viewer),
      reviewerId: ctx.viewer.userId,
      profileId,
      to: "pending",
      patch: { rejectionReason: undefined },
    });
    return null;
  },
});

/** Tier / personal rules / credit changes for an approved mechanic. */
export const update = staffMutation({
  args: {
    profileId: v.id("mechanicProfiles"),
    tierId: v.optional(v.id("priceTiers")),
    personalRules: v.optional(v.union(personalRulesV, v.null())),
    creditEnabled: v.optional(v.boolean()),
    creditLimitPara: v.optional(v.union(v.number(), v.null())),
    paymentTermsDays: v.optional(v.number()),
    internalNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertNotOwnProfile(ctx, args.profileId);
    const profile = await ctx.db.get("mechanicProfiles", args.profileId);
    if (!profile) return notFound("Profil majstora ne postoji.");
    if (args.tierId) {
      const tier = await ctx.db.get("priceTiers", args.tierId);
      if (!tier || !tier.active) invalid("Izaberite aktivan cenovni razred.", "tierId");
    }
    if (args.personalRules) validatePersonalRules(args.personalRules);
    assertCreditLimit(args.creditLimitPara);
    const patch: Partial<Doc<"mechanicProfiles">> = {
      ...(args.tierId ? { tierId: args.tierId } : {}),
      ...(args.personalRules !== undefined
        ? { personalRules: args.personalRules ?? undefined }
        : {}),
      ...(args.creditEnabled !== undefined ? { creditEnabled: args.creditEnabled } : {}),
      ...(args.creditLimitPara !== undefined
        ? { creditLimitPara: args.creditLimitPara ?? undefined }
        : {}),
      ...(args.paymentTermsDays !== undefined
        ? { paymentTermsDays: clampPaymentTerms(args.paymentTermsDays) }
        : {}),
      ...(args.internalNote !== undefined
        ? { internalNote: args.internalNote.slice(0, 1_000) }
        : {}),
      updatedAt: Date.now(),
    };
    await ctx.db.patch("mechanicProfiles", args.profileId, patch);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "mechanic.update",
      entityType: "mechanicProfile",
      entityId: args.profileId,
      summary: `${profile.companyName}: izmenjeni uslovi`,
      // Before/after values, so the owner sees which discount or credit limit was set.
      diff: diffFields(
        profile,
        patch,
        Object.keys(patch).filter((k) => k !== "updatedAt"),
      ),
    });
    return null;
  },
});
