/**
 * Step 22 fix verification (FLOW-07, FLOW-08, FLOW-13, FLOW-17) on the dev server.
 * AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/backend-orders-quotes-ui.mjs
 * Creates one phone-only test inquiry, sends a quote, checks the accept form (390) and the
 * admin composer / share link / e-mail-less conversion (1440); cancels the test order.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

import { BASE, convexRun, launch, loginAdmin, newContext, shot } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/backend-orders-quotes";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const owner = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const auth = await new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL).action(ref("auth:signIn"), {
  provider: "password",
  params: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    flow: "signIn",
  },
});
owner.setAuth(auth.tokens.token);

const { number } = convexRun("testing:createTestInquiry", { tag: "fix22-bo" });
let detail = await owner.query(ref("inquiriesAdmin:get"), { number });
const quoteId = await owner.mutation(ref("inquiriesAdmin:saveQuoteDraft"), {
  inquiryId: detail.inquiry._id,
  lines: [
    {
      name: "Senzor ABS prednji levi",
      quantity: 1,
      unitPricePara: 745_000,
      availability: "on_order",
      leadTimeDays: 3,
    },
  ],
});
await owner.mutation(ref("inquiriesAdmin:sendQuote"), { quoteId });
detail = await owner.query(ref("inquiriesAdmin:get"), { number });
const token = detail.inquiry.statusLink?.split("/upit/")[1];
const out = { number, hasEmail: Boolean(detail.inquiry.contact.email), statusLink: Boolean(token) };

const browser = await launch();
try {
  // Customer accept form at 390.
  const ctx = await newContext(browser, { viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/upit/${token}`, { waitUntil: "networkidle" });
  await page.getByTestId("quote-accept").click();
  out.prefilledPhone = await page.locator("#qa-phone").inputValue();
  await page.locator("#qa-phone").fill("");
  await page.getByTestId("quote-accept-submit").click();
  await page.waitForTimeout(300);
  out.acceptEmpty = await page.evaluate(() => ({
    summary: document.querySelector('[data-testid="quote-accept-errors"]')?.textContent ?? null,
    focus: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
    invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map(
      (e) => e.id || e.getAttribute("role"),
    ),
    describedBy: [...document.querySelectorAll('input[aria-invalid="true"]')].every((e) =>
      Boolean(e.getAttribute("aria-describedby")),
    ),
  }));
  await shot(page, "../fix/backend-orders-quotes/accept-errors-390", {
    fullPage: false,
    locator: page.locator("form").first(),
  });
  const radiosBefore = await page.getByRole("radio").allTextContents();
  await page.getByText("Kupujem kao firma").click();
  out.paymentsGuest = (await page.locator('[role="radiogroup"]').last().textContent()) ?? "";
  out.companyFields = await page.locator("#qa-companyName, #qa-pib, #qa-mb").count();
  out.radiosBefore = radiosBefore.length;
  await shot(page, "../fix/backend-orders-quotes/accept-company-390", {
    locator: page.locator("form").first(),
  });
  await ctx.close();

  // Admin at 1440.
  const actx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const ap = await actx.newPage();
  await loginAdmin(ap);
  await ap.goto(`${BASE}/admin/upiti/${number}`, { waitUntil: "networkidle" });
  out.sharePanel = await ap
    .getByTestId("admin-quote-share")
    .textContent()
    .catch(() => null);
  await shot(ap, "../fix/backend-orders-quotes/admin-share-1440", {
    locator: ap.getByTestId("admin-quote-share"),
  });

  // FLOW-17: an invalid line never opens the confirm dialog; focus goes to the field.
  await ap.getByTestId("admin-quote-compose").click();
  await ap.getByRole("button", { name: "Slobodna stavka" }).click();
  const composer = ap.getByTestId("admin-quote-composer");
  const lastLine = composer
    .locator("li")
    .filter({ has: ap.locator('input[id$="-name"]') })
    .last();
  await lastLine.locator('input[id$="-name"]').fill("Nosač čeljusti");
  await lastLine.locator('input[id$="-quantity"]').fill("1,5");
  await ap.getByTestId("admin-quote-send").click();
  await ap.waitForTimeout(300);
  out.composerInvalid = await ap.evaluate(() => ({
    dialogOpen: Boolean(document.querySelector('[role="alertdialog"]')),
    focusId: document.activeElement?.id ?? null,
    invalidIds: [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.id),
    alert: [
      ...document.querySelectorAll('[data-testid="admin-quote-composer"] [role="alert"]'),
    ].map((e) => e.textContent),
  }));
  await shot(ap, "../fix/backend-orders-quotes/composer-invalid-1440", { locator: lastLine });
  await ap.reload({ waitUntil: "networkidle" });
  out.buttons = await ap.getByRole("button").allTextContents();

  // FLOW-13: convert without an e-mail.
  await ap.getByRole("button", { name: "Pretvori u porudžbinu" }).first().click();
  const dlg = ap.getByRole("dialog");
  out.convertEmailRequired = await dlg.getByLabel(/E-pošta/).getAttribute("aria-required");
  await dlg.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  await ap.waitForURL(/\/admin\/porudzbine\//, { timeout: 30_000 }).catch(() => {});
  out.convertedTo = ap.url().split("/admin/porudzbine/")[1] ?? null;
  out.convertError = await dlg
    .locator('[role="alert"]')
    .textContent()
    .catch(() => null);
  await actx.close();
} finally {
  await browser.close();
}
if (out.convertedTo) {
  const o = await owner.query(ref("ordersAdmin:get"), { number: out.convertedTo });
  out.orderEmail = o.order.contact.email;
  await owner.mutation(ref("ordersAdmin:transition"), {
    orderId: o.order._id,
    to: "otkazana",
    reason: "QA fix test (backend) — otkazano",
    expectedUpdatedAt: o.order.updatedAt,
  });
}
writeFileSync(`${OUT}/ui.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
