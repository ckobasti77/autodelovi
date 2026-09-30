/**
 * Step 21 audit — verification of backend-01, pass 2.
 *  B. Owner converts the already quoted inquiry (argv[2], quote 250.000 RSD > 200.000 RSD limit)
 *     through /admin/upiti/<broj> → „Pretvori u porudžbinu“ → „Odloženo plaćanje“ (e-mail filled).
 *  C. A fresh quoted inquiry; the mechanic (signed in) opens /upit/<token> → „Prihvati ponudu“
 *     and we record which payment options the customer form offers, for pickup and courier.
 *     The quote is then declined so nothing stays open.
 * Appends to docs/qa/audit/verify/backend/backend-01-reproduce.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
import { BASE, launch, newContext, loginWith, loginAdmin, shot } from "./kit.mjs";

const inquiryB = process.argv[2];
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const CONVEX = env.NEXT_PUBLIC_CONVEX_URL;
const OUT = "docs/qa/audit/verify/backend/backend-01-reproduce.json";
const out = JSON.parse(readFileSync(OUT, "utf8"));
out.pass2At = new Date().toISOString();
const log = (step, data) => {
  out.steps.push({ step: `pass2 ${step}`, ...(data ?? {}) });
  console.log(step, data ? JSON.stringify(data) : "");
};
async function client(email, password) {
  const anon = new ConvexHttpClient(CONVEX);
  const r = await anon.action(ref("auth:signIn"), { provider: "password", params: { email, password, flow: "signIn" } });
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

const browser = await launch();
try {
  // ---------- B ----------
  log("B: credit before", await credit());
  const actx = await newContext(browser, { width: 1440, height: 900, tag: "verify-b01-admin2" });
  const ap = await actx.newPage();
  await loginAdmin(ap);
  await ap.goto(`${BASE}/admin/upiti/${inquiryB}`, { waitUntil: "networkidle" });
  await ap.getByRole("button", { name: "Pretvori u porudžbinu" }).click();
  const dlg = ap.getByRole("dialog");
  await dlg.waitFor();
  await dlg.getByLabel(/E-pošta/).fill(acc.mechanic.email);
  await dlg.getByLabel("Plaćanje").selectOption("deferred");
  await shot(ap, "verify/backend/backend-01-reproduce-admin-convert-dialog-1440", { locator: dlg });
  await dlg.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  try {
    await ap.waitForURL(/\/admin\/porudzbine\/SK-/, { timeout: 30_000 });
    const number = decodeURIComponent(new URL(ap.url()).pathname.split("/").pop());
    toCancel.push(number);
    await ap.waitForLoadState("networkidle");
    await ap.waitForTimeout(1000);
    await shot(ap, "verify/backend/backend-01-reproduce-admin-order-created-1440");
    const d = await owner.query(ref("ordersAdmin:get"), { number });
    log("B: admin convert ACCEPTED", {
      number,
      source: d.order.source,
      customerType: d.order.customerType,
      paymentMethod: d.order.paymentMethod,
      totalPara: d.order.totalPara,
      dueInDays: d.order.dueAt ? Math.round((d.order.dueAt - d.order.createdAt) / 86_400_000) : null,
      tierName: d.order.tierName,
    });
    log("B: credit while order open", await credit());
  } catch (e) {
    const err = await dlg.getByRole("alert").innerText().catch(() => null);
    await shot(ap, "verify/backend/backend-01-reproduce-admin-convert-error-1440");
    log("B: admin convert REJECTED or timed out", { alert: err, error: String(e).slice(0, 200) });
  }
  await actx.close();
  for (const n of toCancel.splice(0)) await cancel(n);

  // ---------- C ----------
  const admin = await owner.query(ref("settings:getAdmin"), {});
  const consent = {
    termsVersion: admin.legalVersions.terms,
    privacyVersion: admin.legalVersions.privacy,
    acceptedAt: Date.now(),
    marketingEmail: false,
    analytics: false,
    ads: false,
  };
  const c = await mech.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: "QA audit (verify backend-01 C) — provera ponuđenih načina plaćanja. Ne obrađivati.",
    contact: { name: "QA Verifikacija Majstor", phone: "+381641234567", preferredChannel: "phone" },
    consent,
    honeypot: "",
    startedAt: Date.now() - 12_000,
  });
  const found = await owner.query(ref("inquiriesAdmin:list"), { search: c.number, paginationOpts: { numItems: 5, cursor: null } });
  const inquiryId = found.page.find((r) => r.number === c.number)?._id;
  const quoteId = await owner.mutation(ref("inquiriesAdmin:saveQuoteDraft"), {
    inquiryId,
    lines: [{ name: "QA verifikacija stavka C", quantity: 1, unitPricePara: 1_000_000, availability: "on_order", leadTimeDays: 3 }],
  });
  await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
  log("C: inquiry quoted", { number: c.number });

  const mctx = await newContext(browser, { width: 390, height: 844, tag: "verify-b01-mech2" });
  const mp = await mctx.newPage();
  await loginWith(mp, acc.mechanic.email, acc.mechanic.password, "/majstor");
  await mp.goto(`${BASE}/upit/${c.token}`, { waitUntil: "networkidle" });
  await mp.getByRole("button", { name: "Prihvati ponudu" }).click();
  const group = mp.getByRole("radiogroup", { name: "Plaćanje" });
  await group.waitFor();
  const pickupOpts = await group.getByRole("radio").evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") || e.closest("label")?.innerText?.trim() || document.querySelector(`label[for="${e.id}"]`)?.innerText?.trim() || e.getAttribute("value")),
  );
  await group.scrollIntoViewIfNeeded();
  await shot(mp, "verify/backend/backend-01-reproduce-upit-accept-form-390");
  const courier = mp.getByRole("radio", { name: /Kurir/ });
  let courierOpts = null;
  if (await courier.count()) {
    await courier.first().click();
    courierOpts = await group.getByRole("radio").evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") || e.closest("label")?.innerText?.trim() || document.querySelector(`label[for="${e.id}"]`)?.innerText?.trim() || e.getAttribute("value")),
    );
  }
  log("C: /upit accept form payment options (mechanic signed in, credit enabled)", { pickupOpts, courierOpts });
  await mctx.close();
  await mech.mutation(ref("inquiries:declineQuote"), { token: c.token, quoteId, reason: "QA audit test — zatvoreno" });
  log("C: quote declined (cleanup)");
} finally {
  for (const n of toCancel) await cancel(n).catch((e) => log(`cleanup failed ${n}`, { e: String(e) }));
  log("credit final", await credit().catch(() => null));
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  await browser.close();
  for (const cl of [mech, owner]) await cl.action(ref("auth:signOut"), {}).catch(() => {});
}
