/**
 * Rate limits for every public write (docs/ARCHITECTURE.md §E6), backed by the
 * @convex-dev/rate-limiter component (transactional, no hand-rolled counters).
 *
 * Per-visitor limits are keyed on the salted IP subject (`ctx.client.key`, IPv6 by /64) and
 * sized for carrier NAT, where many phones share one address. Site-wide numbers
 * (`orderSubmitGlobal`, `signUpAlert`) are alarm thresholds that notify the owner instead of
 * closing the shop for everyone (QA BE-02/BE-07, D221).
 */
import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { Scheduler } from "convex/server";

import { components, internal } from "../_generated/api";
import { fail } from "./errors";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  orderSubmit: { kind: "token bucket", rate: 10, period: 10 * MINUTE, capacity: 10 },
  orderSubmitEmail: { kind: "fixed window", rate: 10, period: DAY },
  /** Alarm threshold, not a stop: above it the owner is notified (once per hour). */
  orderSubmitGlobal: { kind: "fixed window", rate: 300, period: HOUR },
  inquirySubmit: { kind: "token bucket", rate: 10, period: 10 * MINUTE, capacity: 10 },
  uploadUrl: { kind: "token bucket", rate: 60, period: HOUR, capacity: 30 },
  mechanicRegister: { kind: "fixed window", rate: 6, period: HOUR },
  backInStock: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  backInStockEmail: { kind: "fixed window", rate: 20, period: DAY },
  searchLog: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  cartWrite: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 120 },
  tokenAction: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  consentLog: { kind: "token bucket", rate: 60, period: HOUR, capacity: 30 },
  passwordReset: { kind: "fixed window", rate: 3, period: HOUR },
  passwordResetGlobal: { kind: "fixed window", rate: 60, period: HOUR },
  /** Hard ceiling for sign-ups (Convex sees only the Next proxy's IP), well above real use. */
  signUpGlobal: { kind: "token bucket", rate: 600, period: HOUR, capacity: 300 },
  /** Alarm threshold for sign-ups: above it the owner is notified (once per hour). */
  signUpAlert: { kind: "fixed window", rate: 60, period: HOUR },
  /** One owner alert per threshold per hour. */
  ownerAlert: { kind: "fixed window", rate: 1, period: HOUR },
  cartCreate: { kind: "token bucket", rate: 100, period: HOUR, capacity: 100 },
  quickOrderMatch: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  importStage: { kind: "token bucket", rate: 600, period: MINUTE, capacity: 600 },
  emailTest: { kind: "fixed window", rate: 10, period: HOUR },
  emailResend: { kind: "fixed window", rate: 30, period: HOUR },
});

export type RateLimitName =
  | "orderSubmit"
  | "orderSubmitEmail"
  | "orderSubmitGlobal"
  | "inquirySubmit"
  | "uploadUrl"
  | "mechanicRegister"
  | "backInStock"
  | "backInStockEmail"
  | "searchLog"
  | "cartWrite"
  | "tokenAction"
  | "consentLog"
  | "passwordReset"
  | "passwordResetGlobal"
  | "signUpGlobal"
  | "signUpAlert"
  | "ownerAlert"
  | "cartCreate"
  | "quickOrderMatch"
  | "importStage"
  | "emailTest"
  | "emailResend";

/** Any mutation ctx, including the Convex Auth callbacks (generic data model). */
type LimitCtx = Parameters<typeof rateLimiter.limit>[0];

/** Consumes one unit or throws RATE_LIMITED with the retry delay. */
export async function enforceRateLimit(
  ctx: LimitCtx,
  name: RateLimitName,
  key: string,
): Promise<void> {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  if (!ok) {
    fail("RATE_LIMITED", "Previše pokušaja. Pokušajte ponovo za nekoliko minuta.", {
      retryAfterMs: Math.ceil(retryAfter ?? 60_000),
    });
  }
}

/** Consumes one unit; returns false instead of throwing (silently dropped writes). */
export async function tryRateLimit(
  ctx: LimitCtx,
  name: RateLimitName,
  key: string,
): Promise<boolean> {
  const { ok } = await rateLimiter.limit(ctx, name, { key });
  return ok;
}

const ALERTS = {
  orderSubmitGlobal: {
    title: "Neuobičajeno mnogo porudžbina",
    body: "Više od 300 porudžbina sa sajta u poslednjih sat vremena. Proverite da li su prave; prijem nije zaustavljen.",
    href: "/admin/porudzbine",
  },
  signUpAlert: {
    title: "Neuobičajeno mnogo novih naloga",
    body: "Više od 60 registracija u poslednjih sat vremena. Proverite listu kupaca; ako ih bude preko 300, registracija se privremeno zatvara.",
    href: "/admin/kupci",
  },
} as const;

/**
 * Counts one unit against a site-wide alarm threshold. Never blocks the caller: when the
 * threshold is crossed the owners get one in-app alert per hour.
 */
export async function countTowardsAlert(
  ctx: LimitCtx & { scheduler: Scheduler },
  name: keyof typeof ALERTS,
): Promise<void> {
  if (await tryRateLimit(ctx, name, "global")) return;
  if (!(await tryRateLimit(ctx, "ownerAlert", name))) return;
  await ctx.scheduler.runAfter(0, internal.notifications.ownerAlert, ALERTS[name]);
}
