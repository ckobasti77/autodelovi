/// <reference types="vite/client" />
/**
 * Step 22 verify (package backend-orders-quotes): adversarial edge cases for BE-01 and BE-02
 * that the implementer's tests do not cover. Isolated convex-test, no shared data.
 * Run: npx vitest run -c scripts/qa/fix/verify-backend-orders-quotes.vitest.config.mts
 */
import { describe, expect, test, vi } from "vitest";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ipSubject } from "../../../convex/lib/functions";
import { rateLimiter } from "../../../convex/lib/rateLimits";
import {
  checkoutArgs,
  CONSENT,
  CONTACT,
  errorCode,
  GUEST,
  makeT,
  setupWorld,
  type T,
  type World,
} from "../../../convex/test.setup";

const DAY = 86_400_000;

async function sentQuote(
  w: World,
  who: "mech" | "anon",
  pricePara: number,
): Promise<{ number: string; token: string; quoteId: Id<"quotes"> }> {
  const client = who === "mech" ? w.asMechA : w.anon;
  const { number, token } = await client.mutation(api.inquiries.submit, {
    kind: "part" as const,
    message: "Treba mi turbina za Golf 7 2.0 TDI.",
    contact: { name: "Majstor Test", phone: "064 111 2222", preferredChannel: "phone" as const },
    consent: CONSENT,
    honeypot: "",
    startedAt: Date.now() - 30_000,
  });
  const detail = (await w.asStaff.query(api.inquiriesAdmin.get, { number }))!;
  const quoteId = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
    inquiryId: detail.inquiry._id,
    lines: [{ name: "Turbina (test)", quantity: 1, unitPricePara: pricePara, availability: "in_stock" }],
  });
  await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId });
  return { number, token, quoteId };
}

const setTerms = (t: T, w: World, patch: Record<string, unknown>) =>
  t.run(async (ctx) => {
    await ctx.db.patch("mechanicProfiles", w.mechA.profileId, patch);
  });

const orderByNumber = (t: T, number: string) =>
  t.run((ctx) =>
    ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique(),
  );

const lastConvertAudit = (t: T) =>
  t.run(
    async (ctx) =>
      (await ctx.db.query("auditLog").order("desc").take(20)).find((a) => a.action === "quote.convert")
        ?.summary ?? null,
  );

const accept = (token: string, quoteId: Id<"quotes">, payment: string, delivery = "pickup") => ({
  token,
  quoteId,
  contact: CONTACT,
  delivery:
    delivery === "courier"
      ? {
          method: "courier" as const,
          address: { street: "Bulevar 1", city: "Beograd", postalCode: "11000" },
        }
      : { method: "pickup" as const },
  payment: { method: payment as "deferred" },
  consent: CONSENT,
});

describe("BE-01 edge cases", () => {
  test("staff conversion within the limit: profile terms (30 d), tier, no override remark", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await setTerms(t, w, { creditLimitPara: 5_000_000, paymentTermsDays: 30 });
    const q = await sentQuote(w, "mech", 1_000_000);
    const before = Date.now();
    const { orderNumber } = await w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
      quoteId: q.quoteId,
      contact: CONTACT,
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
      creditOverride: true, // asked for but not needed: must not be recorded as an override
    });
    const o = (await orderByNumber(t, orderNumber))!;
    expect(o.customerType).toBe("mechanic");
    expect(o.tierSnapshot?.tierId).toBe(w.tiers.majstor);
    expect(o.payment.dueAt! - before).toBeGreaterThanOrEqual(30 * DAY);
    expect(o.payment.dueAt! - before).toBeLessThan(31 * DAY);
    const summary = await lastConvertAudit(t);
    expect(summary).toContain(orderNumber);
    expect(summary).not.toContain("prekoračen");
  });

  test("override cannot grant deferred payment to a mechanic without credit or to a guest", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await setTerms(t, w, { creditEnabled: false });
    const q = await sentQuote(w, "mech", 1_000_000);
    const args = {
      quoteId: q.quoteId,
      contact: CONTACT,
      delivery: { method: "pickup" as const },
      payment: { method: "deferred" as const },
      creditOverride: true,
    };
    expect(await errorCode(() => w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, args))).toBe(
      "INVALID",
    );
    const g = await sentQuote(w, "anon", 1_000_000);
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, { ...args, quoteId: g.quoteId }),
      ),
    ).toBe("INVALID");
  });

  test("override is staff-only: the public accept path has no override argument", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await setTerms(t, w, { creditLimitPara: 500_000 });
    const q = await sentQuote(w, "mech", 1_000_000);
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.inquiries.acceptQuote, {
          ...accept(q.token, q.quoteId, "deferred"),
          creditOverride: true,
        } as never),
      ),
    ).not.toBe("NO_ERROR");
  });

  test("delivery counts towards the limit (courier fee pushes a quote over)", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    // 5.000 RSD quote, limit exactly 5.000 RSD; courier is 450 RSD below 10.000 RSD.
    await setTerms(t, w, { creditLimitPara: 500_000 });
    const q = await sentQuote(w, "mech", 500_000);
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.inquiries.acceptQuote, accept(q.token, q.quoteId, "deferred", "courier")),
      ),
    ).toBe("INVALID");
    const { orderNumber } = await w.asMechA.mutation(
      api.inquiries.acceptQuote,
      accept(q.token, q.quoteId, "deferred", "pickup"),
    );
    expect((await orderByNumber(t, orderNumber))!.totals.totalPara).toBe(500_000);
  });

  test("credit is cumulative: a second deferred acceptance beyond the remainder is refused", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await setTerms(t, w, { creditLimitPara: 1_500_000 });
    const q1 = await sentQuote(w, "mech", 1_000_000);
    await w.asMechA.mutation(api.inquiries.acceptQuote, accept(q1.token, q1.quoteId, "deferred"));
    const q2 = await sentQuote(w, "mech", 1_000_000);
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.inquiries.acceptQuote, accept(q2.token, q2.quoteId, "deferred")),
      ),
    ).toBe("INVALID");
    // Staff conversion of the same quote sees the same remainder.
    expect(
      await errorCode(() =>
        w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
          quoteId: q2.quoteId,
          contact: CONTACT,
          delivery: { method: "pickup" },
          payment: { method: "deferred" },
        }),
      ),
    ).toBe("INVALID");
  });

  test("non-deferred acceptance by the owning mechanic still records tier and mechanic", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const q = await sentQuote(w, "mech", 1_000_000);
    const { orderNumber } = await w.asMechA.mutation(
      api.inquiries.acceptQuote,
      accept(q.token, q.quoteId, "pickup_cash"),
    );
    const o = (await orderByNumber(t, orderNumber))!;
    expect(o.customerType).toBe("mechanic");
    expect(o.mechanicProfileId).toBe(w.mechA.profileId);
    expect(o.tierSnapshot?.tierId).toBe(w.tiers.majstor);
    expect(o.payment.dueAt).toBeUndefined();
  });

  test("a signed-in mechanic accepting a guest inquiry is bound by his own credit", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await setTerms(t, w, { creditLimitPara: 500_000, paymentTermsDays: 30 });
    const g = await sentQuote(w, "anon", 1_000_000);
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.inquiries.acceptQuote, accept(g.token, g.quoteId, "deferred")),
      ),
    ).toBe("INVALID");
  });

  test("orders.submit keeps the D132 behaviour through the shared helper", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await setTerms(t, w, { creditLimitPara: 500_000, paymentTermsDays: 30 });
    await w.asMechA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
    const args = {
      ...checkoutArgs(),
      delivery: { method: "pickup" as const },
      payment: { method: "deferred" as const },
    };
    expect(await errorCode(() => w.asMechA.mutation(api.orders.submit, args as never))).toBe(
      "INVALID",
    );
    await setTerms(t, w, { creditLimitPara: 5_000_000 });
    const before = Date.now();
    const res = await w.asMechA.mutation(api.orders.submit, args as never);
    const o = (await orderByNumber(t, (res as { number: string }).number))!;
    expect(o.tierSnapshot?.tierId).toBe(w.tiers.majstor);
    expect(o.payment.dueAt! - before).toBeGreaterThanOrEqual(30 * DAY);
  });
});

describe("BE-02 edge cases", () => {
  test("ipSubject normalises the forms a client can vary", () => {
    expect(ipSubject(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(ipSubject("::FFFF:203.0.113.7")).toBe("203.0.113.7");
    expect(ipSubject("2001:DB8:12:34::1")).toBe("2001:db8:12:34::/64");
    expect(ipSubject("2001:db8:12:34:0:0:0:1")).toBe("2001:db8:12:34::/64");
    expect(ipSubject("2001:0db8:0012:0034:ffff::")).toBe("2001:db8:12:34::/64");
    expect(ipSubject("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(ipSubject("[2001:db8:12:34::9]")).toBe("2001:db8:12:34::/64");
    expect(ipSubject("2001:db8::")).toBe("2001:db8:0:0::/64");
    // Neighbouring /64s are different subscribers.
    expect(ipSubject("2001:db8:12:35::1")).not.toBe(ipSubject("2001:db8:12:34::1"));
  });

  test("an IPv4 address and its IPv4-mapped IPv6 form share one bucket", async () => {
    const t = makeT();
    await setupWorld(t);
    for (let i = 0; i < 15; i++)
      await t
        .withRequestMetadata({ ip: "198.51.100.20", userAgent: `ua-${i}` })
        .mutation(api.inquiries.generateUploadUrl, {});
    for (let i = 0; i < 15; i++)
      await t
        .withRequestMetadata({ ip: "::ffff:198.51.100.20", userAgent: `ua-m-${i}` })
        .mutation(api.inquiries.generateUploadUrl, {});
    expect(
      await errorCode(() =>
        t
          .withRequestMetadata({ ip: "198.51.100.20", userAgent: "fresh" })
          .mutation(api.inquiries.generateUploadUrl, {}),
      ),
    ).toBe("RATE_LIMITED");
  });

  test("orders from one IP are limited however the User-Agent rotates", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const codes: string[] = [];
    for (let i = 0; i < 11; i++) {
      const token = `rot-token-${String(i).padStart(30, "0")}`;
      const client = t.withRequestMetadata({ ip: "203.0.113.50", userAgent: `rotating-${i}` });
      await client.mutation(api.carts.addItem, {
        guestToken: token,
        productId: w.products.battery,
        quantity: 1,
      });
      codes.push(
        await errorCode(() =>
          client.mutation(api.orders.submit, {
            guestToken: token,
            ...checkoutArgs({ contact: { ...CONTACT, email: `r${i}@primer.rs` } }),
          }),
        ),
      );
    }
    expect(codes.slice(0, 10)).toEqual(Array(10).fill("NO_ERROR"));
    expect(codes[10]).toBe("RATE_LIMITED");
  });

  test("past the global threshold orders keep flowing and the owner gets one alert", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const w = await setupWorld(t);
    await t.run(async (ctx) => {
      await rateLimiter.limit(ctx, "orderSubmitGlobal", { key: "global", count: 300 });
    });
    const numbers: string[] = [];
    for (let i = 0; i < 4; i++) {
      const token = `glob-token-${String(i).padStart(29, "0")}`;
      const client = t.withRequestMetadata({ ip: `198.51.100.${30 + i}`, userAgent: "ua" });
      await client.mutation(api.carts.addItem, {
        guestToken: token,
        productId: w.products.battery,
        quantity: 1,
      });
      const r = await client.mutation(api.orders.submit, {
        guestToken: token,
        ...checkoutArgs({ contact: { ...CONTACT, email: `gl${i}@primer.rs` } }),
      });
      numbers.push(r.number);
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const alerts = await t.run(async (ctx) =>
      (await ctx.db.query("notifications").take(200)).filter((n) => n.kind === "security"),
    );
    vi.useRealTimers();
    expect(numbers).toHaveLength(4);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.userId).toBe(w.owner);
    expect(alerts[0]!.title).toBe("Neuobičajeno mnogo porudžbina");
  });

  test("a guest without IP metadata still works (fallback key)", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    await w.anon.mutation(api.carts.addItem, {
      guestToken: GUEST,
      productId: w.products.battery,
      quantity: 1,
    });
    expect(
      await errorCode(() => w.anon.mutation(api.orders.submit, { guestToken: GUEST, ...checkoutArgs() })),
    ).toBe("NO_ERROR");
  });
});
