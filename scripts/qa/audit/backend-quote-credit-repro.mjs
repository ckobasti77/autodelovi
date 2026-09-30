/**
 * Step 21 audit (backend): reproduces the credit-limit bypass through quote acceptance.
 *
 *  1. The shared approved mechanic (credit enabled, limit from mechanicPortal.overview) submits a
 *     part inquiry (marked as an audit test in the message).
 *  2. The owner saves and sends a one-line quote above the mechanic's available credit.
 *  3. The mechanic accepts it with payment „deferred“ (odloženo plaćanje).
 *  4. Records: order created?, credit before/after, dueAt in days.
 *  5. Cleanup: the owner cancels the test order (reason „QA audit test“) so the credit is released.
 * Tokens stay in memory. Output: docs/qa/audit/backend/quote-credit-repro.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;
async function signIn(email, password) {
  const c0 = new ConvexHttpClient(URL_);
  const r = await c0.action(ref("auth:signIn"), { provider: "password", params: { email, password, flow: "signIn" } });
  const c = new ConvexHttpClient(URL_);
  c.setAuth(r.tokens.token);
  return c;
}
const out = { steps: [] };
const log = (s, v) => {
  out.steps.push({ step: s, ...(v ?? {}) });
  console.log(s, v ? JSON.stringify(v) : "");
};

const mech = await signIn(acc.mechanic.email, acc.mechanic.password);
const owner = await signIn(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
try {
  const pub = await mech.query(ref("settings:getPublic"), {});
  const admin = await owner.query(ref("settings:getAdmin"), {});
  const legal = admin.legalVersions;
  const deferred = admin.paymentMethods.find((p) => p.code === "deferred");
  log("deferred payment method", { active: deferred?.active, deliveryCodes: deferred?.deliveryCodes });
  const before = (await mech.query(ref("mechanicPortal:overview"), {})).credit;
  log("credit before", before);

  const consent = {
    termsVersion: legal.terms,
    privacyVersion: legal.privacy,
    acceptedAt: Date.now(),
    marketingEmail: false,
    analytics: false,
    ads: false,
  };
  const startedAt = Date.now() - 10_000;
  const inq = await mech.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: "QA audit (backend) — test upit za proveru limita odloženog plaćanja. Ne obrađivati.",
    contact: { name: "QA Audit Majstor", phone: "+381641234567", preferredChannel: "phone" },
    consent,
    honeypot: "",
    startedAt,
  });
  log("inquiry submitted", { number: inq.number });

  const found = await owner.query(ref("inquiriesAdmin:list"), {
    search: inq.number,
    paginationOpts: { numItems: 5, cursor: null },
  });
  const inquiryId = found.page.find((r) => r.number === inq.number)?._id;
  const overBy = 5_000_000; // 50.000 RSD above the available credit
  const price = (before.availablePara ?? before.limitPara ?? 0) + overBy;
  const quoteId = await owner.mutation(ref("inquiriesAdmin:saveQuoteDraft"), {
    inquiryId,
    lines: [{ name: "QA audit stavka (test limita)", quantity: 1, unitPricePara: price, availability: "on_order", leadTimeDays: 3 }],
  });
  await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
  log("quote sent", { quoteTotalPara: price, availableCreditPara: before.availablePara });

  const view = await mech.query(ref("inquiries:getByToken"), { token: inq.token });
  const delivery = deferred.deliveryCodes.includes("pickup") ? "pickup" : deferred.deliveryCodes[0];
  let order = null;
  try {
    order = await mech.mutation(ref("inquiries:acceptQuote"), {
      token: inq.token,
      quoteId: view.quote.quoteId,
      contact: { firstName: "QA", lastName: "Audit", email: acc.mechanic.email, phone: "+381641234567" },
      delivery: { method: delivery, ...(delivery === "courier" ? { address: { street: "Test 1", city: "Beograd", postalCode: "11000" } } : {}) },
      payment: { method: "deferred" },
      consent,
    });
    log("acceptQuote with deferred payment ACCEPTED", { orderNumber: order.orderNumber });
  } catch (e) {
    log("acceptQuote rejected", { error: e?.data ?? String(e?.message).slice(0, 200) });
  }

  if (order) {
    const mine = await mech.query(ref("orders:myOrder"), { number: order.orderNumber });
    const dueDays = mine.payment.dueAt ? Math.round((mine.payment.dueAt - mine.createdAt) / 86_400_000) : null;
    const after = (await mech.query(ref("mechanicPortal:overview"), {})).credit;
    const detail = await owner.query(ref("ordersAdmin:get"), { number: order.orderNumber });
    log("order", {
      totalPara: mine.totals.totalPara,
      paymentMethod: mine.payment.method,
      dueInDays: dueDays,
      customerType: mine.customerType,
      tierSnapshot: detail.order.tierName ?? detail.order.tierSnapshot ?? "(not in admin view)",
    });
    log("credit after", after);
    // Cleanup: cancel the test order.
    await owner.mutation(ref("ordersAdmin:transition"), {
      orderId: detail.order._id,
      to: "otkazana",
      reason: "QA audit test (backend) — provera limita, poništeno",
      expectedUpdatedAt: detail.order.updatedAt,
    });
    const afterCancel = (await mech.query(ref("mechanicPortal:overview"), {})).credit;
    log("credit after cleanup (order cancelled)", afterCancel);
  }
} finally {
  writeFileSync("docs/qa/audit/backend/quote-credit-repro.json", JSON.stringify(out, null, 2));
  for (const c of [mech, owner]) await c.action(ref("auth:signOut"), {}).catch(() => {});
}
