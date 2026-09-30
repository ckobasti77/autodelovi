/**
 * Mechanic profile helpers shared by staff functions (`mechanicsAdmin`), the portal
 * (`mechanicPortal`), checkout (`orders.submit`) and the internal e2e helper (`testing`).
 * State machine: docs/DATA-MODEL.md §C7 „Mechanic profile states“.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { canTransitionMechanic, type MechanicStatus } from "../../lib/domain/inquiryStateMachine";
import { audit } from "./audit";
import { fail, invalid, notFound } from "./errors";
import { emitEvent } from "./events";
import type { Actor } from "./validators";

export const MECHANIC_EVENT_FOR: Record<
  MechanicStatus,
  "mechanic.approved" | "mechanic.rejected" | "mechanic.suspended" | "mechanic.reopened"
> = {
  approved: "mechanic.approved",
  rejected: "mechanic.rejected",
  suspended: "mechanic.suspended",
  pending: "mechanic.reopened",
};

export const MECHANIC_STATUS_LABEL_SR: Record<MechanicStatus, string> = {
  pending: "na čekanju",
  approved: "odobren",
  rejected: "odbijen",
  suspended: "pauziran",
};

/** Guarded status change: profile + user patch, `mechanic.*` event and audit in one transaction. */
export async function changeMechanicStatus(
  ctx: MutationCtx,
  input: {
    actor: Actor;
    reviewerId?: Id<"users">;
    profileId: Id<"mechanicProfiles">;
    to: MechanicStatus;
    patch: Partial<Doc<"mechanicProfiles">>;
    reason?: string;
    tierName?: string;
  },
): Promise<void> {
  const profile = await ctx.db.get("mechanicProfiles", input.profileId);
  if (!profile) return notFound("Profil majstora ne postoji.");
  if (!canTransitionMechanic(profile.status, input.to)) {
    fail(
      "INVALID",
      `Majstor je ${MECHANIC_STATUS_LABEL_SR[profile.status]} — taj prelaz nije dozvoljen.`,
    );
  }
  const now = Date.now();
  await ctx.db.patch("mechanicProfiles", input.profileId, {
    ...input.patch,
    status: input.to,
    reviewedAt: now,
    ...(input.reviewerId ? { reviewedBy: input.reviewerId } : {}),
    updatedAt: now,
  });
  await ctx.db.patch("users", profile.userId, { mechanicStatus: input.to });
  const type = MECHANIC_EVENT_FOR[input.to];
  await emitEvent(ctx, {
    type,
    aggregateType: "mechanic",
    aggregateId: input.profileId,
    payload: {
      kind: "mechanic",
      profileId: input.profileId,
      userId: profile.userId,
      companyName: profile.companyName,
      ...(input.tierName ? { tierName: input.tierName } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
    dedupeKey: `${type}:${input.profileId}:${now}`,
    actor: input.actor,
  });
  await audit(ctx, {
    actor: input.actor,
    action: `mechanic.${input.to}`,
    entityType: "mechanicProfile",
    entityId: input.profileId,
    summary: `${profile.companyName}: ${MECHANIC_STATUS_LABEL_SR[profile.status]} → ${MECHANIC_STATUS_LABEL_SR[input.to]}${input.tierName ? ` (${input.tierName})` : ""}`,
    diff: [{ field: "status", before: profile.status, after: input.to }],
  });
}

export function validatePersonalRules(rules: Doc<"mechanicProfiles">["personalRules"]): void {
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

export function clampPaymentTerms(days: number): number {
  return Math.min(90, Math.max(0, Math.round(days)));
}

export function assertCreditLimit(limit: number | undefined | null): void {
  if (limit !== undefined && limit !== null && (!Number.isInteger(limit) || limit < 0)) {
    invalid("Neispravan limit.", "creditLimitPara");
  }
}

export type ApproveInput = {
  profileId: Id<"mechanicProfiles">;
  tierId: Id<"priceTiers">;
  personalRules?: Doc<"mechanicProfiles">["personalRules"];
  creditEnabled: boolean;
  creditLimitPara?: number;
  paymentTermsDays?: number;
};

/** Approve with a tier (+ personal rules, credit). Shared by staff UI and the e2e helper. */
export async function approveMechanic(
  ctx: MutationCtx,
  actor: Actor,
  reviewerId: Id<"users"> | undefined,
  args: ApproveInput,
): Promise<void> {
  const tier = await ctx.db.get("priceTiers", args.tierId);
  if (!tier || !tier.active) invalid("Izaberite aktivan cenovni razred.", "tierId");
  validatePersonalRules(args.personalRules);
  assertCreditLimit(args.creditLimitPara);
  await changeMechanicStatus(ctx, {
    actor,
    ...(reviewerId ? { reviewerId } : {}),
    profileId: args.profileId,
    to: "approved",
    patch: {
      tierId: args.tierId,
      ...(args.personalRules ? { personalRules: args.personalRules } : {}),
      creditEnabled: args.creditEnabled,
      ...(args.creditLimitPara !== undefined ? { creditLimitPara: args.creditLimitPara } : {}),
      ...(args.paymentTermsDays !== undefined
        ? { paymentTermsDays: clampPaymentTerms(args.paymentTermsDays) }
        : {}),
      rejectionReason: undefined,
    },
    tierName: `${tier.name} (${tier.defaultDiscountBp / 100} %)`,
  });
}

/** Orders scanned for open deferred payments (newest first). */
const CREDIT_SCAN = 300;

export type CreditStatus = {
  enabled: boolean;
  limitPara: number | null;
  /** Unpaid deferred orders that are not cancelled. */
  usedPara: number;
  /** `null` when there is no limit. */
  availablePara: number | null;
  paymentTermsDays: number;
  openCount: number;
};

export async function creditStatus(
  ctx: QueryCtx,
  profile: Doc<"mechanicProfiles">,
): Promise<CreditStatus> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_mechanicProfileId", (q) => q.eq("mechanicProfileId", profile._id))
    .order("desc")
    .take(CREDIT_SCAN);
  let usedPara = 0;
  let openCount = 0;
  for (const o of orders) {
    if (o.payment.method !== "deferred" || o.payment.status !== "unpaid") continue;
    if (o.status === "otkazana") continue;
    usedPara += o.totals.totalPara;
    openCount++;
  }
  const limitPara = profile.creditLimitPara ?? null;
  return {
    enabled: profile.status === "approved" && profile.creditEnabled,
    limitPara,
    usedPara,
    availablePara: limitPara === null ? null : Math.max(0, limitPara - usedPara),
    paymentTermsDays: profile.paymentTermsDays,
    openCount,
  };
}

/** `12.990 RSD` without Intl (the Convex runtime's ICU data is not guaranteed). */
export function formatDinarsSr(para: number): string {
  const dinars = Math.round(para / 100);
  return `${String(dinars).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}\u00a0RSD`;
}
