/**
 * Step 22 re-verify (BE-01 fix-up, D252), live against the dev deployment + AUDIT_BASE.
 * Run: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/verify-backend-orders-quotes-r2-be01-live.mjs
 *
 *  A. Audit repro (scripts/qa/audit/backend-quote-credit-repro.mjs, same steps; that script writes
 *     into docs/qa/audit/, so it is not run as-is): the shared mechanic accepts a quote of
 *     available + 50.000 RSD with deferred payment → must be refused, credit unchanged.
 *     UI: the owner's convert dialog (1440) refuses it and offers the override checkbox; a
 *     non-owner staff member (S below) also sees the checkbox on someone else's inquiry.
 *  B. Self-dealing (the fix-up): a fresh account S is signed up, registered as a mechanic,
 *     approved with credit 10.000 RSD (testing:approveMechanic, isTest) and made staff by the
 *     owner. S files an inquiry, the owner quotes 20.000 RSD and sends it.
 *     API: S convertToOrder deferred + creditOverride → FORBIDDEN; without → INVALID (limit).
 *     UI as S at 1440 / 390 / 390 reduced motion: no override checkbox, refusal under „Plaćanje“,
 *     alert points to the field, keyboard order, e-mail help text, courier city probe.
 *     UI as owner on S's inquiry: checkbox offered, override by keyboard creates the order with
 *     tier + terms, audited. Cleanup: order cancelled, quotes declined, S back to customer,
 *     S's mechanic profile suspended.
 * Output: docs/qa/fix/backend-orders-quotes/verify/r2-be01-live.json + r2-be01-*.webp
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
import sharp from "sharp";

import { BASE, convexRun, launch, loginAdmin, loginWith, newContext, watch } from "../audit/kit.mjs";

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

async function signIn(email, password, flow = "signIn", extra = {}) {
  const c0 = new ConvexHttpClient(URL_);
  const r = await c0.action(ref("auth:signIn"), {
    provider: "password",
    params: { email, password, flow, ...extra },
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
function pibCheckDigit(first8) {
  let s = 10;
  for (const ch of first8) {
    s = (s + Number(ch)) % 10;
    s = ((s === 0 ? 10 : s) * 2) % 11;
  }
  return (11 - s) % 10;
}
function mbCheckDigit(first7) {
  const w = [2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(first7[i]) * w[i];
  const k = 11 - (sum % 11);
  return k > 9 ? 0 : k;
}

const out = { base: BASE, convex: URL_, startedAt: new Date().toISOString(), steps: [] };
const log = (step, v) => {
  out.steps.push({ step, ...(v ?? {}) });
  console.log(step, v ? JSON.stringify(v) : "");
};

const owner = await signIn(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
const mech = await signIn(acc.mechanic.email, acc.mechanic.password);
const admin = await owner.query(ref("settings:getAdmin"), {});
const consent = () => ({
  termsVersion: admin.legalVersions.terms,
  privacyVersion: admin.legalVersions.privacy,
  acceptedAt: Date.now(),
  marketingEmail: false,
  analytics: false,
  ads: false,
});
const openQuotes = []; // { token, quoteId, client }
const ordersToCancel = [];
let browser;
let S = null; // { email, password, client, userId, profileId }

async function inquiryWithQuote(client, label, pricePara) {
  const inq = await client.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: `QA re-verify step 22 (BE-01 ${label}) — test upit za limit odloženog plaćanja. Ne obrađivati.`,
    contact: { name: "QA Reverify Majstor", phone: "+381641234567", preferredChannel: "phone" },
    consent: consent(),
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
        name: `QA reverify stavka (BE-01 ${label})`,
        quantity: 1,
        unitPricePara: pricePara,
        availability: "on_order",
        leadTimeDays: 3,
      },
    ],
  });
  await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
  const entry = { number: inq.number, token: inq.token, quoteId, client };
  openQuotes.push(entry);
  return entry;
}
async function cancelOrder(number) {
  const d = await owner.query(ref("ordersAdmin:get"), { number });
  await owner.mutation(ref("ordersAdmin:transition"), {
    orderId: d.order._id,
    to: "otkazana",
    reason: "QA re-verify step 22 (BE-01) — test, poništeno",
    expectedUpdatedAt: d.order.updatedAt,
  });
}
async function declineQuote(entry) {
  await entry.client.mutation(ref("inquiries:declineQuote"), {
    token: entry.token,
    quoteId: entry.quoteId,
    reason: "QA re-verify step 22 — test, zatvoreno",
  });
  openQuotes.splice(openQuotes.indexOf(entry), 1);
}

/** Opens the convert dialog and selects „Odloženo plaćanje“ (no submit). */
async function openDeferred(page, number, emailFill) {
  await page.goto(`${BASE}/admin/upiti/${number}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Pretvori u porudžbinu" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const email = dialog.getByLabel(/E-pošta/);
  const helpBefore = await dialog.getByText(/Kupac nije ostavio e-poštu/).count();
  const emailDescribedBefore = await email.getAttribute("aria-describedby");
  if (emailFill && (await email.inputValue()) === "") await email.fill(emailFill);
  const helpAfter = await dialog.getByText(/Kupac nije ostavio e-poštu/).count();
  const emailDescribedAfter = await email.getAttribute("aria-describedby");
  const danglingDescribedBy = await email.evaluate((el) =>
    (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((id) => !document.getElementById(id)),
  );
  const paySelect = dialog.getByLabel("Plaćanje");
  const options = await paySelect.locator("option").allTextContents();
  const deferredLabel = options.find((o) => /odlo/i.test(o));
  await paySelect.selectOption({ label: deferredLabel });
  const checkbox = dialog.getByRole("checkbox", { name: /Dozvoli prekoračenje/ });
  return {
    dialog,
    paySelect,
    checkbox,
    options,
    emailHelp: { helpBefore, helpAfter, emailDescribedBefore, emailDescribedAfter, danglingDescribedBy },
  };
}
async function submitAndReadAlert(page, dialog) {
  await dialog.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  const alert = dialog.getByRole("alert").first();
  await alert.waitFor({ timeout: 20_000 });
  return (await alert.innerText()).trim();
}
async function payFieldState(dialog) {
  const sel = dialog.getByLabel("Plaćanje");
  return sel.evaluate((el) => ({
    ariaInvalid: el.getAttribute("aria-invalid"),
    describedByText: (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? `(missing #${id})`),
  }));
}

try {
  // ---------- A. audit repro: public path over the limit ----------
  const c0 = (await mech.query(ref("mechanicPortal:overview"), {})).credit;
  log("A: shared mechanic credit before", c0);
  const available = c0.availablePara ?? c0.limitPara ?? 0;
  const A = await inquiryWithQuote(mech, "A", available + 5_000_000);
  log("A: quote sent", { number: A.number, quotePara: available + 5_000_000, availablePara: available });
  const aRes = await attempt(() =>
    mech.mutation(ref("inquiries:acceptQuote"), {
      token: A.token,
      quoteId: A.quoteId,
      contact: { firstName: "QA", lastName: "Reverify", email: acc.mechanic.email, phone: "+381641234567" },
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
      consent: consent(),
    }),
  );
  if (aRes.ok) ordersToCancel.push(aRes.value.orderNumber);
  log("A: mechanic acceptQuote deferred over the limit", aRes);
  log("A: credit after", (await mech.query(ref("mechanicPortal:overview"), {})).credit);

  // ---------- B. set up the staff member who is also a credit mechanic ----------
  const stamp = Date.now();
  const sEmail = `qa-reverify-be01-${stamp}@primer.rs`;
  const sPassword = `Reverify${stamp}x`;
  const sClient = await signIn(sEmail, sPassword, "signUp", { name: "QA Reverify Zaposleni" });
  const first8 = `1${String(stamp).slice(-7)}`;
  const pib = `${first8}${pibCheckDigit(first8)}`;
  const first7 = `7${String(stamp).slice(-6)}`;
  const mb = `${first7}${mbCheckDigit(first7)}`;
  const profileId = await sClient.mutation(ref("mechanics:register"), {
    companyName: `QA Reverify Servis ${stamp}`,
    pib,
    mb,
    contactPerson: "QA Reverify Zaposleni",
    phone: "+381641112233",
    city: "Beograd",
    address: "Test 1",
    serviceTypes: ["mehanika"],
    brandsServiced: [],
    consent: consent(),
  });
  const approved = convexRun("testing:approveMechanic", {
    email: sEmail,
    creditEnabled: true,
    creditLimitPara: 1_000_000,
  });
  const sViewer = await sClient.query(ref("users:viewer"), {});
  await owner.mutation(ref("staff:setRole"), { userId: sViewer.userId, role: "staff" });
  S = { email: sEmail, password: sPassword, client: sClient, userId: sViewer.userId, profileId };
  const sViewer2 = await sClient.query(ref("users:viewer"), {});
  const sCredit = (await sClient.query(ref("mechanicPortal:overview"), {})).credit;
  log("B: staff+mechanic account ready", {
    email: sEmail,
    role: sViewer2.role,
    isStaff: sViewer2.isStaff,
    isOwner: sViewer2.isOwner,
    mechanicStatus: sViewer2.mechanicStatus,
    tier: approved.tierName,
    credit: sCredit,
  });

  const B = await inquiryWithQuote(sClient, "B self", 2_000_000);
  log("B: own inquiry quoted", { number: B.number, quotePara: 2_000_000 });
  const convertArgs = {
    quoteId: B.quoteId,
    contact: { firstName: "QA", lastName: "Reverify", email: sEmail, phone: "+381641112233" },
    delivery: { method: "pickup" },
    payment: { method: "deferred" },
  };
  const bOverride = await attempt(() =>
    sClient.mutation(ref("inquiriesAdmin:convertToOrder"), { ...convertArgs, creditOverride: true }),
  );
  if (bOverride.ok) ordersToCancel.push(bOverride.value.orderNumber);
  log("B/API: staff converts own inquiry with creditOverride", bOverride);
  const bPlain = await attempt(() => sClient.mutation(ref("inquiriesAdmin:convertToOrder"), convertArgs));
  if (bPlain.ok) ordersToCancel.push(bPlain.value.orderNumber);
  log("B/API: staff converts own inquiry without override", bPlain);
  log("B: staff credit after refusals", (await sClient.query(ref("mechanicPortal:overview"), {})).credit);

  // ---------- UI ----------
  browser = await launch();
  // B/UI as S (non-owner staff, own inquiry) at 1440, 390 and 390 reduced motion.
  for (const vp of [
    { tag: "1440", width: 1440, height: 900, reducedMotion: "no-preference" },
    { tag: "390", width: 390, height: 844, reducedMotion: "no-preference" },
    { tag: "390-rm", width: 390, height: 844, reducedMotion: "reduce" },
  ]) {
    const ctx = await newContext(browser, { ...vp, tag: `reverify-be01-${vp.tag}` });
    const page = await ctx.newPage();
    const w = watch(page);
    try {
      await loginWith(page, sEmail, sPassword, "/admin");
      const r = await openDeferred(page, B.number, vp.tag === "1440" ? sEmail : null);
      const checkboxCount = await r.checkbox.count();
      // Keyboard: Tab from the payment select must land on „Odustani“ (no hidden checkbox stop).
      await r.paySelect.focus();
      await page.keyboard.press("Tab");
      const afterTab = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        role: document.activeElement?.getAttribute("role"),
        text: document.activeElement?.textContent?.trim().slice(0, 40),
      }));
      const alertText = await submitAndReadAlert(page, r.dialog);
      const pay = await payFieldState(r.dialog);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      log(`B/UI ${vp.tag}: staff on own inquiry, deferred over the limit`, {
        paymentOptions: r.options,
        overrideCheckboxCount: checkboxCount,
        tabFromPaymentLandsOn: afterTab,
        alert: alertText,
        paymentField: pay,
        url: page.url(),
        overflowX: overflow,
        emailHelp: r.emailHelp,
        shot: await snap(r.dialog, `r2-be01-staffself-${vp.tag}-refused`),
      });
      if (vp.tag === "1440") {
        // Courier with an empty city: which field does the alert point to?
        await r.dialog.getByLabel("Dostava").selectOption({ value: "courier" });
        await r.dialog.getByLabel(/Ulica i broj/).fill("Test 1");
        await r.dialog.getByLabel(/Poštanski broj/).fill("11000");
        const alert2 = await submitAndReadAlert(page, r.dialog);
        const fieldErrors = await r.dialog.evaluate((d) =>
          [...d.querySelectorAll("[aria-invalid='true']")].map((el) => ({
            label: el.id ? d.querySelector(`label[for='${el.id}']`)?.textContent?.trim() : null,
            describedBy: (el.getAttribute("aria-describedby") ?? "")
              .split(/\s+/)
              .filter(Boolean)
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? null),
          })),
        );
        log("B/UI 1440: courier with empty Mesto (alert pointer probe)", {
          alert: alert2,
          invalidFields: fieldErrors,
          shot: await snap(r.dialog, "r2-be01-staffself-1440-city-probe"),
        });
      }
      await r.dialog.getByRole("button", { name: "Odustani" }).click();
      log(`B/UI ${vp.tag}: console`, { console: w.console, pageErrors: w.pageErrors });
    } finally {
      await ctx.close();
    }
  }

  // A/UI as S (non-owner staff) on the shared mechanic's inquiry: checkbox must be offered.
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "reverify-be01-staff-other" });
    const page = await ctx.newPage();
    const w = watch(page);
    try {
      await loginWith(page, sEmail, sPassword, "/admin");
      const r = await openDeferred(page, A.number, acc.mechanic.email);
      const alertText = await submitAndReadAlert(page, r.dialog);
      log("A/UI 1440: non-owner staff on another mechanic's inquiry", {
        overrideCheckboxVisible: await r.checkbox.isVisible(),
        alert: alertText,
        paymentField: await payFieldState(r.dialog),
        shot: await snap(r.dialog, "r2-be01-staff-other-1440"),
        console: w.console,
        pageErrors: w.pageErrors,
      });
      await r.dialog.getByRole("button", { name: "Odustani" }).click();
    } finally {
      await ctx.close();
    }
  }
  await declineQuote(A);
  log("A: cleanup — quote declined");

  // B/UI as owner on S's inquiry: checkbox offered, keyboard override creates the order.
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "reverify-be01-owner" });
    const page = await ctx.newPage();
    const w = watch(page);
    try {
      await loginAdmin(page);
      const r = await openDeferred(page, B.number, sEmail);
      const alertText = await submitAndReadAlert(page, r.dialog);
      await r.paySelect.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Space");
      log("B/UI owner 1440: refused, then override by keyboard", {
        alert: alertText,
        overrideCheckboxVisible: await r.checkbox.isVisible(),
        ariaCheckedAfterSpace: await r.checkbox.getAttribute("aria-checked"),
        shot: await snap(r.dialog, "r2-be01-owner-on-staff-inquiry-1440"),
      });
      await r.dialog.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
      await page.waitForURL(/\/admin\/porudzbine\//, { timeout: 30_000 });
      const orderNumber = decodeURIComponent(page.url().split("/").pop());
      ordersToCancel.push(orderNumber);
      openQuotes.splice(openQuotes.indexOf(B), 1);
      const d = await owner.query(ref("ordersAdmin:get"), { number: orderNumber });
      const auditPage = await owner.query(ref("audit:list"), {
        action: "quote.convert",
        paginationOpts: { numItems: 20, cursor: null },
      });
      log("B/UI owner 1440: order created with override", {
        orderNumber,
        customerType: d.order.customerType,
        paymentMethod: d.order.paymentMethod,
        totalPara: d.order.totalPara,
        tierName: d.order.tierName,
        dueInDays: d.order.dueAt ? (d.order.dueAt - d.order.createdAt) / DAY : null,
        auditSummary: auditPage.page.find((a) => a.summary.includes(orderNumber))?.summary ?? null,
        console: w.console,
        pageErrors: w.pageErrors,
      });
      await cancelOrder(orderNumber);
      ordersToCancel.splice(ordersToCancel.indexOf(orderNumber), 1);
      log("B: cleanup — order cancelled", {
        creditAfter: (await sClient.query(ref("mechanicPortal:overview"), {})).credit,
      });
    } finally {
      await ctx.close();
    }
  }
} catch (e) {
  log("ERROR", { message: String(e?.stack ?? e?.message ?? e).slice(0, 800) });
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const n of [...ordersToCancel]) {
    try {
      await cancelOrder(n);
      log("finally: cancelled", { n });
    } catch (e) {
      log("finally: cancel failed", { n, message: String(e?.message ?? e).slice(0, 200) });
    }
  }
  for (const q of [...openQuotes]) {
    try {
      await declineQuote(q);
      log("finally: declined", { number: q.number });
    } catch (e) {
      log("finally: decline failed", { number: q.number, message: String(e?.message ?? e).slice(0, 200) });
    }
  }
  if (S) {
    try {
      await owner.mutation(ref("staff:setRole"), { userId: S.userId, role: "customer" });
      await owner.mutation(ref("mechanicsAdmin:suspend"), {
        profileId: S.profileId,
        reason: "QA re-verify step 22 — test nalog",
      });
      log("finally: test account demoted to customer, mechanic profile suspended", { email: S.email });
    } catch (e) {
      log("finally: account cleanup failed", { message: String(e?.message ?? e).slice(0, 200) });
    }
  }
  log("finally: shared mechanic credit", (await mech.query(ref("mechanicPortal:overview"), {})).credit);
  out.finishedAt = new Date().toISOString();
  writeFileSync(path.join(OUT, "r2-be01-live.json"), JSON.stringify(out, null, 2));
  for (const c of [mech, owner, S?.client].filter(Boolean)) await c.action(ref("auth:signOut"), {}).catch(() => {});
}
