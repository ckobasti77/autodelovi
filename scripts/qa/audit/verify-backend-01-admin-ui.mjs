/**
 * Step 21 audit — backend-01 skeptic verification, staff UI path (no order is created).
 *  1. The shared approved mechanic submits a part inquiry (marked as an audit test).
 *  2. The owner saves and sends a one-line quote above the mechanic's remaining deferred limit.
 *  3. In the admin UI (/admin/upiti/<broj>, 1440 px) the owner opens „Pretvori u porudžbinu“ and
 *     inspects the „Plaćanje“ select: is „Odloženo plaćanje“ offered, is any limit shown/warned?
 *  4. The dialog is closed without submitting; the mechanic declines the quote (closes the inquiry).
 * Output: docs/qa/audit/verify/backend/backend-01-skeptic-admin-ui.json + two WebP shots.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

import { launch, newContext, watch, shot, loginAdmin, BASE } from "./kit.mjs";

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
const OUT = "docs/qa/audit/verify/backend";
mkdirSync(OUT, { recursive: true });
const out = { steps: [] };
const log = (s, v) => {
  out.steps.push({ step: s, ...(v ?? {}) });
  console.log(s, v ? JSON.stringify(v) : "");
};

const mech = await signIn(acc.mechanic.email, acc.mechanic.password);
const owner = await signIn(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
let inq;
let quoteId;
try {
  const admin = await owner.query(ref("settings:getAdmin"), {});
  const legal = admin.legalVersions;
  const credit = (await mech.query(ref("mechanicPortal:overview"), {})).credit;
  log("mechanic credit before", credit);
  const consent = {
    termsVersion: legal.terms,
    privacyVersion: legal.privacy,
    acceptedAt: Date.now(),
    marketingEmail: false,
    analytics: false,
    ads: false,
  };
  inq = await mech.mutation(ref("inquiries:submit"), {
    kind: "part",
    message: "QA audit (verify backend-01) — test upit, ponuda iznad limita. Ne obrađivati.",
    contact: { name: "QA Verify Majstor", phone: "+381641234567", preferredChannel: "phone" },
    consent,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  });
  log("inquiry submitted by mechanic", { number: inq.number });
  const found = await owner.query(ref("inquiriesAdmin:list"), {
    search: inq.number,
    paginationOpts: { numItems: 5, cursor: null },
  });
  const inquiryId = found.page.find((r) => r.number === inq.number)?._id;
  const price = (credit.availablePara ?? credit.limitPara ?? 0) + 5_000_000;
  quoteId = await owner.mutation(ref("inquiriesAdmin:saveQuoteDraft"), {
    inquiryId,
    lines: [{ name: "QA verify stavka (test limita)", quantity: 1, unitPricePara: price, availability: "on_order", leadTimeDays: 3 }],
  });
  await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
  log("quote sent", { quoteTotalPara: price, availablePara: credit.availablePara });

  // Customer quote page as the mechanic would see it: which payment methods are offered?
  const browser = await launch();
  try {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-b01" });
    const page = await ctx.newPage();
    const w = watch(page);
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/upiti/${inq.number}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pretvori u porudžbinu" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const paySelect = dialog.locator("select").last();
    const options = await paySelect.locator("option").allTextContents();
    log("admin convert dialog payment options (pickup)", { options });
    const deferredLabel = options.find((o) => /odlo/i.test(o));
    if (deferredLabel) await paySelect.selectOption({ label: deferredLabel });
    const dialogText = (await dialog.innerText()).replace(/\s+/g, " ");
    log("dialog text after choosing deferred", {
      mentionsLimit: /limit|preostal/i.test(dialogText),
      text: dialogText.slice(0, 600),
    });
    await shot(page, "verify/backend/backend-01-skeptic-admin-convert-dialog", { locator: dialog });
    await shot(page, "verify/backend/backend-01-skeptic-admin-convert-viewport");
    await dialog.getByRole("button", { name: "Odustani" }).click();
    log("dialog closed without submitting", { consoleErrors: w.console.length, pageErrors: w.pageErrors.length });
    await ctx.close();
  } finally {
    await browser.close();
  }
} finally {
  if (inq && quoteId) {
    try {
      await mech.mutation(ref("inquiries:declineQuote"), {
        token: inq.token,
        quoteId,
        reason: "QA audit verify backend-01 — test, zatvoreno",
      });
      log("cleanup: quote declined by mechanic, inquiry closed");
    } catch (e) {
      log("cleanup failed", { error: String(e?.message).slice(0, 200) });
    }
  }
  writeFileSync(`${OUT}/backend-01-skeptic-admin-ui.json`, JSON.stringify(out, null, 2));
  for (const c of [mech, owner]) await c.action(ref("auth:signOut"), {}).catch(() => {});
}
