/// <reference types="vite/client" />
/**
 * Step 21 audit — independent verification of backend-01 (skeptic lens), isolated in convex-test
 * (no shared data touched). Mechanic A (approved, credit on, tier Majstor) gets a 5.000 RSD limit
 * and 30-day terms. Three paths, same over-limit amount (10.000 RSD):
 *   control  — orders.submit with deferred (expected: refused, D132)
 *   customer — inquiries.acceptQuote with deferred (the /upit/[token] mutation)
 *   staff    — inquiriesAdmin.convertToOrder with deferred (admin „Pretvori u porudžbinu“)
 * Run: npx vitest run --config scripts/qa/audit/verify-backend-01.vitest.config.mts
 */
import { expect, test } from "vitest";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  CONSENT,
  CONTACT,
  errorCode,
  makeT,
  setupWorld,
  type World,
} from "../../../convex/test.setup";

const DAY = 86_400_000;

async function mechInquiryWithSentQuote(w: World, pricePara: number) {
  const { number, token } = await w.asMechA.mutation(api.inquiries.submit, {
    kind: "part" as const,
    message: "Treba mi turbina za Golf 7 2.0 TDI, originalni broj nemam.",
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
  return { number, token, quoteId: quoteId as Id<"quotes">, userIdOnInquiry: detail.inquiry.userId ?? null };
}

async function orderDoc(t: ReturnType<typeof makeT>, number: string) {
  return t.run((ctx) =>
    ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique(),
  );
}

test("backend-01: credit limit / terms / tier on quote paths", async () => {
  const t = makeT();
  const w = await setupWorld(t);
  await w.asStaff.mutation(api.mechanicsAdmin.update, {
    profileId: w.mechA.profileId,
    creditLimitPara: 500_000, // 5.000 RSD
    paymentTermsDays: 30,
  });
  const out: Record<string, unknown> = {};
  out.creditBefore = (await w.asMechA.query(api.mechanicPortal.overview, {}))?.credit;

  // Control: normal checkout, 1 × T-DISC (discounted ~9.000 RSD) > 5.000 RSD limit.
  await w.asMechA.mutation(api.carts.addItem, { productId: w.products.disc, quantity: 1 });
  out.control = {
    submitDeferred: await errorCode(() =>
      w.asMechA.mutation(api.orders.submit, {
        contact: CONTACT,
        delivery: { method: "pickup" },
        payment: { method: "deferred" },
        consent: CONSENT,
        honeypot: "",
        startedAt: Date.now() - 30_000,
      } as never),
    ),
  };

  // Customer path: acceptQuote with deferred, 10.000 RSD quote.
  const a = await mechInquiryWithSentQuote(w, 1_000_000);
  let customer: Record<string, unknown> = { inquiryUserIdSet: a.userIdOnInquiry !== null };
  try {
    const r = await w.asMechA.mutation(api.inquiries.acceptQuote, {
      token: a.token,
      quoteId: a.quoteId,
      contact: CONTACT,
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
      consent: CONSENT,
    });
    const o = (await orderDoc(t, r.orderNumber))!;
    customer = {
      ...customer,
      result: "ACCEPTED",
      orderNumber: r.orderNumber,
      totalPara: o.totals.totalPara,
      payment: o.payment.method,
      dueInDays: o.payment.dueAt ? Math.round((o.payment.dueAt - o._creationTime) / DAY) : null,
      tierSnapshot: o.tierSnapshot ?? null,
      customerType: o.customerType,
    };
  } catch (e) {
    customer = { ...customer, result: "REFUSED", code: await errorCode(() => Promise.reject(e)) };
  }
  out.customerAcceptQuote = customer;
  out.creditAfterCustomerPath = (await w.asMechA.query(api.mechanicPortal.overview, {}))?.credit;

  // Staff path: convertToOrder with deferred for the same mechanic, another 10.000 RSD quote.
  const b = await mechInquiryWithSentQuote(w, 1_000_000);
  let staff: Record<string, unknown> = {};
  try {
    const r = await w.asStaff.mutation(api.inquiriesAdmin.convertToOrder, {
      quoteId: b.quoteId,
      contact: CONTACT,
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
    });
    const o = (await orderDoc(t, r.orderNumber))!;
    staff = {
      result: "ACCEPTED",
      orderNumber: r.orderNumber,
      totalPara: o.totals.totalPara,
      payment: o.payment.method,
      dueInDays: o.payment.dueAt ? Math.round((o.payment.dueAt - o._creationTime) / DAY) : null,
      tierSnapshot: o.tierSnapshot ?? null,
    };
  } catch (e) {
    staff = { result: "REFUSED", code: await errorCode(() => Promise.reject(e)) };
  }
  out.staffConvertToOrder = staff;
  out.creditAfterStaffPath = (await w.asMechA.query(api.mechanicPortal.overview, {}))?.credit;

  // Guest (no account) accepting a quote with deferred → must still be refused by validateCheckout.
  const g = await w.anon.mutation(api.inquiries.submit, {
    kind: "part" as const,
    message: "Treba mi turbina za Golf 7 2.0 TDI, originalni broj nemam.",
    contact: { name: "Gost Test", phone: "064 111 3333", preferredChannel: "phone" as const },
    consent: CONSENT,
    honeypot: "",
    startedAt: Date.now() - 30_000,
  });
  const gd = (await w.asStaff.query(api.inquiriesAdmin.get, { number: g.number }))!;
  const gq = await w.asStaff.mutation(api.inquiriesAdmin.saveQuoteDraft, {
    inquiryId: gd.inquiry._id,
    lines: [{ name: "Turbina (test)", quantity: 1, unitPricePara: 1_000_000, availability: "in_stock" }],
  });
  await w.asStaff.mutation(api.inquiriesAdmin.sendQuote, { quoteId: gq });
  out.guestAcceptDeferred = await errorCode(() =>
    w.anon.mutation(api.inquiries.acceptQuote, {
      token: g.token,
      quoteId: gq,
      contact: CONTACT,
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
      consent: CONSENT,
    }),
  );

  console.log("BACKEND01_RESULT " + JSON.stringify(out, null, 2));
  expect(out).toBeTruthy();
});
