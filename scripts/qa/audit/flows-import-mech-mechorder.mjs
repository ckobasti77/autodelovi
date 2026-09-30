/**
 * Step 21 audit (flows-import-mech): quick order with duplicate lines of a low-stock part → cart →
 * checkout with deferred payment → order history → „Poruči ponovo“. Writes mechorder.json.
 *   node scripts/qa/audit/flows-import-mech-mechorder.mjs
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { loginMechanic } from "./flows-import-mech-lib.mjs";

const T = "flows-import-mech";
const out = {};
const save = () => writeFileSync(`docs/qa/audit/${T}/mechorder.json`, JSON.stringify(out, null, 2));
const text = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\n{2,}/g, "\n").slice(0, 3500);

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-mechorder" });
const page = await ctx.newPage();
const log = watch(page);
await loginMechanic(page);

// empty the cart first
await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
for (let i = 0; i < 10; i++) {
  const rm = page.getByRole("button", { name: /Ukloni/ }).first();
  if (!(await rm.count())) break;
  await rm.click().catch(() => {});
  await page.waitForTimeout(1200);
}
out.cartEmpty = await text(page.locator("main"));

await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
await page.getByTestId("mechanic-quick-order-input").fill(["5Q0615505R 2", "5Q0 615 505 R 2", "036 121 959 P 1"].join("\n"));
await page.getByTestId("mechanic-quick-order-check").click();
await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(4000);
out.quick = await text(page.locator('[aria-label="Rezultat provere"]'));
await page.getByTestId("mechanic-quick-order-add-all").click();
await page.waitForTimeout(4000);
out.afterAdd = await text(page.locator("body"));
await shot(page, `${T}/mechorder-after-add-1440`);

await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(6000);
out.cart = await text(page.locator("main"));
await shot(page, `${T}/mechorder-cart-1440`, { fullPage: true });
save();

// checkout
await page.goto(`${BASE}/porudzbina`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(6000);
try {
  await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30000 });
  out.contact = await text(page.locator("main"));
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-delivery").waitFor({ timeout: 20000 });
  const pc = page.getByLabel("Poštanski broj");
  if (!(await pc.inputValue())) await pc.fill("34000");
  out.delivery = await text(page.locator("main"));
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-payment").waitFor({ timeout: 20000 });
  out.payment = await text(page.locator("main"));
  await page.getByRole("radio", { name: /Odloženo plaćanje/ }).click();
  await page.waitForTimeout(800);
  await shot(page, `${T}/mechorder-payment-1440`);
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-review").waitFor({ timeout: 20000 });
  out.review = await text(page.locator("main"));
  await shot(page, `${T}/mechorder-review-1440`, { fullPage: true });
  await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
  await page.getByTestId("checkout-submit").click();
  await page.getByTestId("order-number").first().waitFor({ timeout: 60000 });
  out.number = (await page.getByTestId("order-number").first().textContent())?.trim();
  out.thanks = await text(page.locator("main"));
  out.thanksUrl = page.url();
  await shot(page, `${T}/mechorder-thanks-1440`);
} catch (e) {
  out.checkoutError = String(e).slice(0, 500);
  out.checkoutState = await text(page.locator("main"));
  await shot(page, `${T}/mechorder-checkout-error-1440`);
}
save();

// history + reorder
await page.goto(`${BASE}/majstor/porudzbine`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
out.history = (await text(page.locator("main"))).slice(0, 1500);
const re = page.getByRole("button", { name: /Poruči ponovo/ }).first();
if (await re.count()) {
  await re.click();
  await page.waitForTimeout(4000);
  out.afterReorder = (await text(page.locator("body"))).slice(0, 2500);
  await shot(page, `${T}/mechorder-reorder-1440`);
}
await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
out.cartAfterReorder = await text(page.locator("main"));
out.log = log;
save();
console.log(JSON.stringify(out, null, 1).slice(0, 14000));
await browser.close();
