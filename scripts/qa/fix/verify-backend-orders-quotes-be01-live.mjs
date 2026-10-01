/**
 * Step 22 verify (BE-01, live): mechanic terms on both quote paths against the dev deployment.
 * Run: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/verify-backend-orders-quotes-be01-live.mjs
 *
 *  A. Public path, over the limit: the shared mechanic accepts a quote of (available + 50.000 RSD)
 *     with deferred payment through inquiries:acceptQuote → must be refused (INVALID, limit
 *     message), credit unchanged. The audit customer holding the same token gets no
 *     deferredCredit and is refused too. Admin UI at 390 px: the convert dialog refuses the same
 *     quote and shows the override checkbox. Cleanup: the mechanic declines the quote.
 *  B. Staff path, over the limit, admin UI at 1440 px: „Pretvori u porudžbinu“ with „Odloženo
 *     plaćanje“ → refused with the limit message; the override checkbox is toggled by keyboard
 *     (Tab + Space) → order created with tier snapshot and profile terms; the audit summary
 *     records the override. Cleanup: the order is cancelled (credit released).
 *  C. Public path, within the limit: the mechanic accepts a 1.000 RSD quote with deferred payment
 *     → order with tier snapshot, customerType mechanic, dueAt = profile terms. Cleanup: cancel.
 * Output: docs/qa/fix/backend-orders-quotes/verify/be01-live.json + WebP shots.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
import sharp from "sharp";

import { BASE, launch, loginAdmin, newContext, watch } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/backend-orders-quotes/verify";
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;
const DAY = 86_400_000;

async function signIn(email, password) {
  const c0 = new ConvexHttpClient(URL_);
  const r = await c0.action(ref("auth:signIn"), {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
  const c = new ConvexHttpClient(URL_);
  c.setAuth(r.tokens.token);
  return c;
}
async function attempt(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return {
      ok: false,
      code: e?.data?.code ?? null,
      message: e?.data?.message ?? String(e?.message ?? e).slice(0, 200),
      field: e?.data?.field ?? null,
      creditLimit: e?.data?.creditLimit ?? null,
    };
  }
}
async function snap(locatorOrPage, name) {
  const buf = await locatorOrPage.screenshot({ type: "png" });
  const file = path.join(OUT, `${name}.webp`);
  await sharp(buf).webp({ quality: 70 }).toFile(file);
  return file.replaceAll("\\", "/");
}

const out = { base: BASE, convex: URL_, steps: [] };
const log = (step, v) => {
  out.steps.push({ step, ...(v ?? {}) });
  console.log(step, v ? JSON.stringify(v) : "");
};

const mech = await signIn(acc.mechanic.email, acc.mechanic.password);
const owner = await signIn(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
const customer = await signIn(acc.customer.email, acc.customer.password);
const openQuotes = []; // { token, quoteId } to decline on cleanup
const ordersToCancel = []; // order numbers
let browser;

const credit = async () => (await mech.query(ref("mechanicPortal:overview"), {})).credit;

async function mechanicInquiryWithQuote(label, pricePara) {
  const admin = await owner.query(ref("settings:getAdmin"), {});
  const consent = {
    termsVersion: admin.legalVersions.terms,
    privacyVersion: admin.legalVersions.privacy,
    acceptedAt: Date.now(),
    marketingEmail: false,
    analytics: false,
    ads: false,
  };
  const inq = await mech.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: `QA verify step 22 (BE-01 ${label}) — test upit za limit odloženog plaćanja. Ne obrađivati.`,
    contact: { name: "QA Verify Majstor", phone: "+381641234567", preferredChannel: "phone" },
    consent,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  });
  const found = await owner.query(ref("inquiriesAdmin:list"), {
    search: inq.number,
    paginationOpts: { numItems: 5, cursor: null },
  });
  const inquiryId = found.page.find((r) => r.number === inq.number)?._id;
  const quoteId = await owner.mutation(ref("inquiriesAdmin:saveQuoteDraft"), {
    inquiryId,
    lines: [
      {
        name: `QA verify stavka (BE-01 ${label})`,
        quantity: 1,
        unitPricePara: pricePara,
        availability: "on_order",
        leadTimeDays: 3,
      },
    ],
  });
  await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
  const entry = { number: inq.number, token: inq.token, quoteId, consent };
  openQuotes.push(entry);
  return entry;
}

async function orderFacts(number) {
  const d = await owner.query(ref("ordersAdmin:get"), { number });
  const o = d.order;
  return {
    number,
    customerType: o.customerType,
    mechanicProfileId: o.mechanicProfileId,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    totalPara: o.totalPara,
    tierName: o.tierName,
    dueAt: o.dueAt,
    createdAt: o.createdAt,
    _id: o._id,
    updatedAt: o.updatedAt,
  };
}

async function cancelOrder(number) {
  const d = await owner.query(ref("ordersAdmin:get"), { number });
  await owner.mutation(ref("ordersAdmin:transition"), {
    orderId: d.order._id,
    to: "otkazana",
    reason: "QA verify step 22 (BE-01) — test, poništeno",
    expectedUpdatedAt: d.order.updatedAt,
  });
}

/** Opens the convert dialog for `number`, picks deferred, submits; returns the dialog locator. */
async function convertDeferred(page, number) {
  await page.goto(`${BASE}/admin/upiti/${number}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Pretvori u porudžbinu" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const email = dialog.getByLabel(/E-pošta/);
  if ((await email.inputValue()) === "") await email.fill(acc.mechanic.email);
  const paySelect = dialog.locator("select").last();
  const options = await paySelect.locator("option").allTextContents();
  const deferredLabel = options.find((o) => /odlo/i.test(o));
  await paySelect.selectOption({ label: deferredLabel });
  await dialog.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  const alert = dialog.getByRole("alert").first();
  await alert.waitFor({ timeout: 20_000 });
  return { dialog, paySelect, options, alertText: (await alert.innerText()).trim() };
}

try {
  const c0 = await credit();
  log("credit before", c0);
  const available = c0.availablePara ?? c0.limitPara ?? 0;

  // ---------- A. public path, over the limit ----------
  const A = await mechanicInquiryWithQuote("A", available + 5_000_000);
  log("A: quote sent", { number: A.number, quotePara: available + 5_000_000, availablePara: available });
  const viewMech = await mech.query(ref("inquiries:getByToken"), { token: A.token });
  const viewCust = await customer.query(ref("inquiries:getByToken"), { token: A.token });
  log("A: getByToken deferredCredit", {
    owningMechanic: viewMech.deferredCredit,
    otherSignedInCustomer: viewCust.deferredCredit,
  });
  const acceptArgs = (who) => ({
    token: A.token,
    quoteId: A.quoteId,
    contact: { firstName: "QA", lastName: "Verify", email: who, phone: "+381641234567" },
    delivery: { method: "pickup" },
    payment: { method: "deferred" },
    consent: A.consent,
  });
  const aMech = await attempt(() => mech.mutation(ref("inquiries:acceptQuote"), acceptArgs(acc.mechanic.email)));
  if (aMech.ok) ordersToCancel.push(aMech.value.orderNumber);
  log("A: mechanic acceptQuote deferred over limit", aMech);
  const aCust = await attempt(() => customer.mutation(ref("inquiries:acceptQuote"), acceptArgs(acc.customer.email)));
  if (aCust.ok) ordersToCancel.push(aCust.value.orderNumber);
  log("A: other signed-in customer acceptQuote deferred", aCust);
  log("A: credit after", await credit());

  browser = await launch();
  // Admin UI at 390 px on inquiry A (refusal + checkbox visible), then cancel the dialog.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-be01-390" });
    const page = await ctx.newPage();
    const w = watch(page);
    await loginAdmin(page);
    const r = await convertDeferred(page, A.number);
    const checkbox = r.dialog.getByRole("checkbox", { name: /Dozvoli prekoračenje/ });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    log("A/UI 390: convert deferred over limit", {
      paymentOptions: r.options,
      alert: r.alertText,
      overrideCheckboxVisible: await checkbox.isVisible(),
      overflowX: overflow,
      shot: await snap(r.dialog, "be01-ui-390-refused"),
    });
    await r.dialog.getByRole("button", { name: "Odustani" }).click();
    log("A/UI 390: console", { console: w.console, pageErrors: w.pageErrors });
    await ctx.close();
  }
  await mech.mutation(ref("inquiries:declineQuote"), {
    token: A.token,
    quoteId: A.quoteId,
    reason: "QA verify step 22 — test, zatvoreno",
  });
  openQuotes.splice(openQuotes.indexOf(A), 1);
  log("A: cleanup — quote declined, inquiry closed");

  // ---------- B. staff path (admin UI 1440), over the limit ----------
  const B = await mechanicInquiryWithQuote("B", available + 5_000_000);
  log("B: quote sent", { number: B.number, quotePara: available + 5_000_000 });
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-be01-1440" });
    const page = await ctx.newPage();
    const w = watch(page);
    await loginAdmin(page);
    const r = await convertDeferred(page, B.number);
    const selectInvalid = await r.paySelect.getAttribute("aria-invalid");
    log("B/UI 1440: refused without override", {
      alert: r.alertText,
      paymentSelectAriaInvalid: selectInvalid,
      urlStill: page.url(),
      shot: await snap(r.dialog, "be01-ui-1440-refused"),
    });
    // Keyboard: from the payment select, Tab reaches the override checkbox, Space checks it.
    await r.paySelect.focus();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => ({
      role: document.activeElement?.getAttribute("role"),
      state: document.activeElement?.getAttribute("data-state"),
      label: document.activeElement?.closest("label,div")?.textContent?.trim().slice(0, 80),
    }));
    await page.keyboard.press("Space");
    const checkbox = r.dialog.getByRole("checkbox", { name: /Dozvoli prekoračenje/ });
    log("B/UI 1440: keyboard toggles override", {
      focusedAfterTab: focused,
      ariaCheckedAfterSpace: await checkbox.getAttribute("aria-checked"),
      shot: await snap(r.dialog, "be01-ui-1440-override-checked"),
    });
    await r.dialog.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
    await page.waitForURL(/\/admin\/porudzbine\//, { timeout: 30_000 });
    const orderNumber = decodeURIComponent(page.url().split("/").pop());
    ordersToCancel.push(orderNumber);
    await page.waitForLoadState("networkidle");
    log("B/UI 1440: order created with override", {
      orderNumber,
      shot: await snap(page, "be01-ui-1440-order-created"),
      console: w.console,
      pageErrors: w.pageErrors,
    });
    await ctx.close();
    const facts = await orderFacts(orderNumber);
    const c = await credit();
    log("B: order facts", {
      ...facts,
      dueInDays: facts.dueAt && facts.createdAt ? (facts.dueAt - facts.createdAt) / DAY : null,
      profileTermsDays: c.paymentTermsDays,
    });
    const auditPage = await owner.query(ref("audit:list"), {
      action: "quote.convert",
      paginationOpts: { numItems: 20, cursor: null },
    });
    log("B: audit summary", {
      summary: auditPage.page.find((a) => a.summary.includes(orderNumber))?.summary ?? null,
    });
    log("B: credit while the override order is open", c);
    await cancelOrder(orderNumber);
    ordersToCancel.splice(ordersToCancel.indexOf(orderNumber), 1);
    openQuotes.splice(openQuotes.indexOf(B), 1);
    log("B: cleanup — order cancelled", { creditAfter: await credit() });
  }

  // ---------- C. public path, within the limit ----------
  const C = await mechanicInquiryWithQuote("C", 100_000);
  const cRes = await attempt(() =>
    mech.mutation(ref("inquiries:acceptQuote"), {
      token: C.token,
      quoteId: C.quoteId,
      contact: { firstName: "QA", lastName: "Verify", email: acc.mechanic.email, phone: "+381641234567" },
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
      consent: C.consent,
    }),
  );
  log("C: mechanic acceptQuote deferred within limit", cRes);
  if (cRes.ok) {
    openQuotes.splice(openQuotes.indexOf(C), 1);
    ordersToCancel.push(cRes.value.orderNumber);
    const facts = await orderFacts(cRes.value.orderNumber);
    const c = await credit();
    log("C: order facts", {
      ...facts,
      dueInDays: facts.dueAt && facts.createdAt ? (facts.dueAt - facts.createdAt) / DAY : null,
      profileTermsDays: c.paymentTermsDays,
    });
    await cancelOrder(cRes.value.orderNumber);
    ordersToCancel.splice(ordersToCancel.indexOf(cRes.value.orderNumber), 1);
    log("C: cleanup — order cancelled", { creditAfter: await credit() });
  }
} catch (e) {
  log("ERROR", { message: String(e?.message ?? e).slice(0, 500) });
} finally {
  if (browser) await browser.close();
  for (const n of [...ordersToCancel]) {
    try {
      await cancelOrder(n);
      log("finally: cancelled", { n });
    } catch (e) {
      log("finally: cancel failed", { n, error: String(e?.message).slice(0, 200) });
    }
  }
  for (const q of [...openQuotes]) {
    try {
      await mech.mutation(ref("inquiries:declineQuote"), {
        token: q.token,
        quoteId: q.quoteId,
        reason: "QA verify step 22 — test, zatvoreno",
      });
      log("finally: declined", { number: q.number });
    } catch (e) {
      log("finally: decline failed", { number: q.number, error: String(e?.message).slice(0, 200) });
    }
  }
  writeFileSync(`${OUT}/be01-live.json`, JSON.stringify(out, null, 2));
  for (const c of [mech, owner, customer]) await c.action(ref("auth:signOut"), {}).catch(() => {});
}
process.exit(0);
