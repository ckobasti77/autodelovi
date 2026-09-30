/**
 * Rate limits for every public write (docs/ARCHITECTURE.md §E6), backed by the
 * @convex-dev/rate-limiter component (transactional, no hand-rolled counters).
 */
import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "../_generated/api";
import { fail } from "./errors";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  orderSubmit: { kind: "token bucket", rate: 5, period: 10 * MINUTE, capacity: 5 },
  orderSubmitEmail: { kind: "fixed window", rate: 10, period: DAY },
  orderSubmitGlobal: { kind: "fixed window", rate: 300, period: HOUR },
  inquirySubmit: { kind: "token bucket", rate: 5, period: 10 * MINUTE, capacity: 5 },
  uploadUrl: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  mechanicRegister: { kind: "fixed window", rate: 3, period: HOUR },
  backInStock: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  backInStockEmail: { kind: "fixed window", rate: 20, period: DAY },
  searchLog: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  cartWrite: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 120 },
  tokenAction: { kind: "token bucket", rate: 10, period: HOUR, capacity: 10 },
  consentLog: { kind: "token bucket", rate: 20, period: HOUR, capacity: 20 },
  passwordReset: { kind: "fixed window", rate: 3, period: HOUR },
  passwordResetGlobal: { kind: "fixed window", rate: 60, period: HOUR },
  signUpGlobal: { kind: "token bucket", rate: 60, period: HOUR, capacity: 30 },
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
