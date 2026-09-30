/// <reference types="vite/client" />
/**
 * Step 21 audit — backend-05 skeptic check: convex/notify.test.ts › „reminders count working
 * minutes…“ fails whenever setupWorld runs at a real wall-clock time later than the hardcoded
 * order time (30.09.2026 16:30 Belgrade), because convex-test keeps `_creationTime` monotonic
 * (node_modules/convex-test/dist/index.js:105). Same body as notify.test.ts:470-485, with the
 * clock at setupWorld time pinned instead of taken from the real clock.
 *
 *   npx vitest run --config scripts/qa/audit/verify-backend-06.vitest.config.mts scripts/qa/audit/verify-backend-05-clock.test.ts
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api, internal } from "../../../convex/_generated/api";
import { belgradeLocalToUtc } from "../../../lib/domain/time";
import { checkoutArgs, GUEST, makeT, setupWorld } from "../../../convex/test.setup";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EMAIL_MODE", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const local = (d: number, h: number, m = 0) => belgradeLocalToUtc(2026, 9, d, h, m);

async function remindedAt0931(worldBuiltAt: number) {
  vi.setSystemTime(worldBuiltAt);
  const t = makeT();
  const w = await setupWorld(t);
  vi.setSystemTime(local(30, 16, 30));
  await w.anon.mutation(api.carts.addItem, { guestToken: GUEST, productId: w.products.battery, quantity: 1 });
  const res = await w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() });
  const created = await t.run(async (ctx) =>
    (await ctx.db.query("orders").take(5)).find((o) => o.number === res.number)!._creationTime,
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.setSystemTime(belgradeLocalToUtc(2026, 10, 1, 9, 31));
  const r = await t.mutation(internal.automations.runReminders, {});
  return { worldBuiltAt: new Date(worldBuiltAt).toISOString(), orderCreationTime: new Date(created).toISOString(), result: r };
}

test("world built before 16:30 (like a morning run) → first reminder at 09:31", async () => {
  const out = await remindedAt0931(local(30, 16, 0));
  console.log(`VERIFY05 ${JSON.stringify({ case: "built 16:00", ...out })}`);
  expect(out.result.reminded).toBe(1);
});

test("world built after 16:30 (any run from 30.09.2026 16:30 on) → no reminder", async () => {
  const out = await remindedAt0931(local(30, 16, 45));
  console.log(`VERIFY05 ${JSON.stringify({ case: "built 16:45", ...out })}`);
  expect(out.result.reminded).toBe(0);
});

test("world built a week later (e.g. 07.10.2026) → no reminder", async () => {
  const out = await remindedAt0931(belgradeLocalToUtc(2026, 10, 7, 10, 0));
  console.log(`VERIFY05 ${JSON.stringify({ case: "built 07.10.", ...out })}`);
  expect(out.result.reminded).toBe(0);
});
