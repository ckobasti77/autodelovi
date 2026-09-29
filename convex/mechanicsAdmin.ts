/**
 * Staff mechanic approvals (docs/DATA-MODEL.md §C7 mechanic states): pending → approved |
 * rejected; approved ⇄ suspended; rejected → pending. Each change updates
 * `users.mechanicStatus`, emits `mechanic.*` and is audited.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { canTransitionMechanic, type MechanicStatus } from "../lib/domain/inquiryStateMachine";
import { audit } from "./lib/audit";
import { actorOf, type Viewer } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { emitEvent } from "./lib/events";
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
  isDemo: p.isDemo,
});

export const list = staffQuery({
  args: { status: v.optional(mechanicStatusV) },
  returns: v.array(rowV),
  handler: async (ctx, { status }) => {
    const rows = status
      ? await ctx.db
          .query("mechanicProfiles")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(200)
      : await ctx.db.query("mechanicProfiles").order("desc").take(200);
    return rows.map(toRow);
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
      personalRules: v.union(personalRulesV, v.null()),
      creditLimitPara: v.union(v.number(), v.null()),
      paymentTermsDays: v.number(),
      internalNote: v.union(v.string(), v.null()),
      rejectionReason: v.union(v.string(), v.null()),
      attribution: v.union(attributionV, v.null()),
      userEmail: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    const p = await ctx.db.get("mechanicProfiles", profileId);
    if (!p) return null;
    const user = await ctx.db.get("users", p.userId);
    return {
      profile: toRow(p),
      mb: p.mb,
      address: p.address,
      serviceTypes: p.serviceTypes,
      brandsServiced: p.brandsServiced,
      personalRules: p.personalRules ?? null,
      creditLimitPara: p.creditLimitPara ?? null,
      paymentTermsDays: p.paymentTermsDays,
      internalNote: p.internalNote ?? null,
      rejectionReason: p.rejectionReason ?? null,
      attribution: p.attribution ?? null,
      userEmail: user?.email ?? null,
    };
  },
});

const EVENT_FOR: Record<
  MechanicStatus,
  "mechanic.approved" | "mechanic.rejected" | "mechanic.suspended" | "mechanic.reopened"
> = {
  approved: "mechanic.approved",
  rejected: "mechanic.rejected",
  suspended: "mechanic.suspended",
  pending: "mechanic.reopened",
};

const LABEL: Record<MechanicStatus, string> = {
  pending: "na čekanju",
  approved: "odobren",
  rejected: "odbijen",
  suspended: "pauziran",
};

async function changeStatus(
  ctx: MutationCtx,
  viewer: Viewer,
  profileId: Id<"mechanicProfiles">,
  to: MechanicStatus,
  patch: Partial<Doc<"mechanicProfiles">>,
  extra: { reason?: string; tierName?: string },
): Promise<void> {
  const profile = await ctx.db.get("mechanicProfiles", profileId);
  if (!profile) return notFound("Profil majstora ne postoji.");
  if (!canTransitionMechanic(profile.status, to)) {
    fail("INVALID", `Majstor je ${LABEL[profile.status]} — taj prelaz nije dozvoljen.`);
  }
  const now = Date.now();
  await ctx.db.patch("mechanicProfiles", profileId, {
    ...patch,
    status: to,
    reviewedAt: now,
    reviewedBy: viewer.userId,
    updatedAt: now,
  });
  await ctx.db.patch("users", profile.userId, { mechanicStatus: to });
  const actor = actorOf(viewer);
  await emitEvent(ctx, {
    type: EVENT_FOR[to],
    aggregateType: "mechanic",
    aggregateId: profileId,
    payload: {
      kind: "mechanic",
      profileId,
      userId: profile.userId,
      companyName: profile.companyName,
      ...(extra.tierName ? { tierName: extra.tierName } : {}),
      ...(extra.reason ? { reason: extra.reason } : {}),
    },
    dedupeKey: `${EVENT_FOR[to]}:${profileId}:${now}`,
    actor,
  });
  await audit(ctx, {
    actor,
    action: `mechanic.${to}`,
    entityType: "mechanicProfile",
    entityId: profileId,
    summary: `${profile.companyName}: ${LABEL[profile.status]} → ${LABEL[to]}${extra.tierName ? ` (${extra.tierName})` : ""}`,
    diff: [{ field: "status", before: profile.status, after: to }],
  });
}

function validatePersonalRules(rules: Doc<"mechanicProfiles">["personalRules"]) {
  if (!rules) return;
  const bps = [
    ...(rules.defaultDiscountBp !== undefined ? [rules.defaultDiscountBp] : []),
    ...(rules.categoryRules ?? []).map((r) => r.discountBp),
    ...(rules.manufacturerRules ?? []).map((r) => r.discountBp),
  ];
  if (bps.some((bp) => !Number.isInteger(bp) || bp < 0 || bp > 9_000))
    invalid("Rabat mora biti između 0 i 90 %.", "personalRules");
  if ((rules.categoryRules?.length ?? 0) > 50 || (rules.manufacturerRules?.length ?? 0) > 100)
    invalid("Previše ličnih izuzetaka.", "personalRules");
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
    const tier = await ctx.db.get("priceTiers", args.tierId);
    if (!tier || !tier.active) invalid("Izaberite aktivan cenovni razred.", "tierId");
    validatePersonalRules(args.personalRules);
    if (
      args.creditLimitPara !== undefined &&
      (!Number.isInteger(args.creditLimitPara) || args.creditLimitPara < 0)
    ) {
      invalid("Neispravan limit.", "creditLimitPara");
    }
    await changeStatus(
      ctx,
      ctx.viewer,
      args.profileId,
      "approved",
      {
        tierId: args.tierId,
        ...(args.personalRules ? { personalRules: args.personalRules } : {}),
        creditEnabled: args.creditEnabled,
        ...(args.creditLimitPara !== undefined ? { creditLimitPara: args.creditLimitPara } : {}),
        ...(args.paymentTermsDays !== undefined
          ? { paymentTermsDays: Math.min(90, Math.max(0, Math.round(args.paymentTermsDays))) }
          : {}),
        rejectionReason: undefined,
      },
      { tierName: `${tier.name} (${tier.defaultDiscountBp / 100} %)` },
    );
    return null;
  },
});

export const reject = staffMutation({
  args: { profileId: v.id("mechanicProfiles"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { profileId, reason }) => {
    const text = reason.trim().slice(0, 500);
    if (text.length < 3) invalid("Upišite razlog.", "reason");
    await changeStatus(
      ctx,
      ctx.viewer,
      profileId,
      "rejected",
      { rejectionReason: text },
      { reason: text },
    );
    return null;
  },
});

export const suspend = staffMutation({
  args: { profileId: v.id("mechanicProfiles"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { profileId, reason }) => {
    await changeStatus(
      ctx,
      ctx.viewer,
      profileId,
      "suspended",
      {},
      reason ? { reason: reason.slice(0, 500) } : {},
    );
    return null;
  },
});

export const reactivate = staffMutation({
  args: { profileId: v.id("mechanicProfiles") },
  returns: v.null(),
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get("mechanicProfiles", profileId);
    if (!profile) return notFound("Profil majstora ne postoji.");
    const tier = profile.tierId ? await ctx.db.get("priceTiers", profile.tierId) : null;
    await changeStatus(
      ctx,
      ctx.viewer,
      profileId,
      "approved",
      {},
      tier ? { tierName: tier.name } : {},
    );
    return null;
  },
});

export const reopen = staffMutation({
  args: { profileId: v.id("mechanicProfiles") },
  returns: v.null(),
  handler: async (ctx, { profileId }) => {
    await changeStatus(ctx, ctx.viewer, profileId, "pending", { rejectionReason: undefined }, {});
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
    const profile = await ctx.db.get("mechanicProfiles", args.profileId);
    if (!profile) return notFound("Profil majstora ne postoji.");
    if (args.tierId) {
      const tier = await ctx.db.get("priceTiers", args.tierId);
      if (!tier || !tier.active) invalid("Izaberite aktivan cenovni razred.", "tierId");
    }
    if (args.personalRules) validatePersonalRules(args.personalRules);
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
        ? { paymentTermsDays: Math.min(90, Math.max(0, Math.round(args.paymentTermsDays))) }
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
      diff: Object.keys(patch)
        .filter((k) => k !== "updatedAt")
        .map((field) => ({ field })),
    });
    return null;
  },
});
