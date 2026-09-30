/**
 * Step 21 audit — independent verification of backend-01 (deferred-payment credit limit on
 * quote → order paths). Written from scratch by the verifier.
 *
 *  A. Public path: the shared approved mechanic submits an inquiry, the owner quotes above the
 *     mechanic's available credit, the mechanic (own session) opens /upit/<token> in a browser
 *     (records which payment options the UI offers) and then calls inquiries:acceptQuote with
 *     payment „deferred“ directly (as devtools would). Order is cancelled right after.
 *  B. Staff path through the real admin UI: a second inquiry, quoted above the available credit,
 *     converted by the owner in /admin/upiti/<broj> → „Pretvori u porudžbinu“ with
 *     „Odloženo plaćanje“. Order is cancelled right after.
 * Output: docs/qa/audit/verify/backend/backend-01-reproduce.json (+ WebP screenshots).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
import { BASE, launch, newContext, loginWith, loginAdmin, shot } from "./kit.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const CONVEX = env.NEXT_PUBLIC_CONVEX_URL;
const OUT = "docs/qa/audit/verify/backend/backend-01-reproduce.json";
mkdirSync("docs/qa/audit/verify/backend", { recursive: true });

const out = { base: BASE, at: new Date().toISOString(), steps: [] };
const log = (step, data) => {
  out.steps.push({ step, ...(data ?? {}) });
  console.log(step, data ? JSON.stringify(data) : "");
};

async function client(email, password) {
  const anon = new ConvexHttpClient(CONVEX);
  const r = await anon.action(ref("auth:signIn"), {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
  const c = new ConvexHttpClient(CONVEX);
  c.setAuth(r.tokens.token);
  return c;
}

const mech = await client(acc.mechanic.email, acc.mechanic.password);
const owner = await client(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
const credit = async () => (await mech.query(ref("mechanicPortal:overview"), {})).credit;
const toCancel = [];

async function cancel(number) {
  const d = await owner.query(ref("ordersAdmin:get"), { number });
  if (!d || d.order.status === "otkazana") return;
  await owner.mutation(ref("ordersAdmin:transition"), {
    orderId: d.order._id,
    to: "otkazana",
    reason: "QA audit verify backend-01 — test limita, poništeno",
    expectedUpdatedAt: d.order.updatedAt,
  });
  log(`cancelled ${number}`, { creditAfterCancel: await credit() });
}

async function quotedInquiry(tag, pricePara) {
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
    message: `QA audit (verify backend-01 ${tag}) — test upit za proveru limita odloženog plaćanja. Ne obrađivati.`,
    contact: { name: "QA Verifikacija Majstor", phone: "+381641234567", preferredChannel: "phone" },
    consent,
    honeypot: "",
    startedAt: Date.now() - 12_000,
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
        name: `QA verifikacija stavka ${tag} (test limita)`,
        quantity: 1,
        unitPricePara: pricePara,
        availability: "on_order",
        leadTimeDays: 3,
      },
    ],
  });
  await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
  return { ...inq, consent };
}

async function orderFacts(number) {
  const mine = await mech.query(ref("orders:myOrder"), { number });
  const d = await owner.query(ref("ordersAdmin:get"), { number });
  return {
    number,
    source: d.order.source,
    customerType: d.order.customerType,
    paymentMethod: d.order.paymentMethod,
    totalPara: d.order.totalPara,
    dueInDays: d.order.dueAt ? Math.round((d.order.dueAt - d.order.createdAt) / 86_400_000) : null,
    tierName: d.order.tierName,
    myOrderPaymentDue: mine?.payment?.dueAt ?? null,
  };
}

const browser = await launch();
try {
  const before = await credit();
  log("credit before", before);
  const overPara = (before.availablePara ?? before.limitPara ?? 0) + 5_000_000;

  // ---------- A. public acceptQuote ----------
  const a = await quotedInquiry("A", overPara);
  log("A: inquiry quoted above available credit", { number: a.number, quotePara: overPara });

  const mctx = await newContext(browser, { width: 390, height: 844, tag: "verify-b01-mech" });
  const mp = await mctx.newPage();
  await loginWith(mp, acc.mechanic.email, acc.mechanic.password, "/majstor");
  await mp.goto(`${BASE}/upit/${a.token}`, { waitUntil: "networkidle" });
  const payOpts = await mp
    .locator("form")
    .filter({ hasText: /plaćanj/i })
    .first()
    .evaluate((f) => {
      const radios = [...f.querySelectorAll('[role="radio"], input[type="radio"]')].map(
        (r) => r.getAttribute("aria-label") || r.closest("label")?.textContent?.trim() || r.value,
      );
      const opts = [...f.querySelectorAll("option")].map((o) => o.textContent.trim());
      return { radios, opts, text: f.innerText.slice(0, 1500) };
    })
    .catch((e) => ({ error: String(e) }));
  log("A: /upit/<token> accept form (mechanic signed in, 390) payment controls", payOpts);
  const payHeading = mp.getByText(/Način plaćanja|Plaćanje/).first();
  await payHeading.scrollIntoViewIfNeeded().catch(() => {});
  await shot(mp, "verify/backend/backend-01-reproduce-upit-accept-form-390");
  await mctx.close();

  let orderA = null;
  try {
    orderA = await mech.mutation(ref("inquiries:acceptQuote"), {
      token: a.token,
      quoteId: (await mech.query(ref("inquiries:getByToken"), { token: a.token })).quote.quoteId,
      contact: { firstName: "QA", lastName: "Verifikacija", email: acc.mechanic.email, phone: "+381641234567" },
      delivery: { method: "pickup" },
      payment: { method: "deferred" },
      consent: a.consent,
    });
    toCancel.push(orderA.orderNumber);
    log("A: acceptQuote(deferred) ACCEPTED", { orderNumber: orderA.orderNumber });
    log("A: order", await orderFacts(orderA.orderNumber));
    log("A: credit while order open", await credit());
  } catch (e) {
    log("A: acceptQuote(deferred) REJECTED", { error: e?.data ?? String(e?.message).slice(0, 300) });
  }
  if (orderA) await cancel(orderA.orderNumber);

  // ---------- B. staff convert through the admin UI ----------
  const before2 = await credit();
  const overParaB = (before2.availablePara ?? before2.limitPara ?? 0) + 5_000_000;
  const b = await quotedInquiry("B", overParaB);
  log("B: inquiry quoted above available credit", { number: b.number, quotePara: overParaB, creditBefore: before2 });

  const actx = await newContext(browser, { width: 1440, height: 900, tag: "verify-b01-admin" });
  const ap = await actx.newPage();
  await loginAdmin(ap);
  await ap.goto(`${BASE}/admin/upiti/${b.number}`, { waitUntil: "networkidle" });
  await ap.getByRole("button", { name: "Pretvori u porudžbinu" }).click();
  const dlg = ap.getByRole("dialog");
  await dlg.waitFor();
  const paySel = dlg.getByLabel("Plaćanje");
  const optionLabels = await paySel.locator("option").allTextContents();
  await paySel.selectOption("deferred");
  const dialogText = await dlg.innerText();
  log("B: admin convert dialog", {
    paymentOptions: optionLabels,
    mentionsLimit: /limit|preostal/i.test(dialogText),
    dialogText: dialogText.slice(0, 800),
  });
  await shot(ap, "verify/backend/backend-01-reproduce-admin-convert-dialog-1440", { locator: dlg });
  await dlg.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  let orderB = null;
  try {
    await ap.waitForURL(/\/admin\/porudzbine\/SK-/, { timeout: 30_000 });
    orderB = decodeURIComponent(new URL(ap.url()).pathname.split("/").pop());
    toCancel.push(orderB);
    await ap.waitForLoadState("networkidle");
    await ap.waitForTimeout(800);
    await shot(ap, "verify/backend/backend-01-reproduce-admin-order-created-1440");
    log("B: admin convert ACCEPTED", await orderFacts(orderB));
    log("B: credit while order open", await credit());
  } catch (e) {
    const err = await dlg.getByRole("alert").innerText().catch(() => null);
    await shot(ap, "verify/backend/backend-01-reproduce-admin-convert-error-1440");
    log("B: admin convert REJECTED or timed out", { alert: err, error: String(e).slice(0, 200) });
  }
  await actx.close();
  if (orderB) await cancel(orderB);
} finally {
  for (const n of toCancel) await cancel(n).catch((e) => log(`cleanup failed ${n}`, { e: String(e) }));
  log("credit final", await credit().catch(() => null));
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  await browser.close();
  for (const c of [mech, owner]) await c.action(ref("auth:signOut"), {}).catch(() => {});
}
