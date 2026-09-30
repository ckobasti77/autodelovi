/**
 * flows-shop follow-ups: product 404 rendering over time, over-stock add feedback, back-in-stock
 * with consent (valid + duplicate), unsubscribe with a bad token (click „Odjavi me“).
 */
import { BASE, convexRun, launch, newContext, shot, watch } from "./kit.mjs";
import { P, saveJson, sleep } from "./flows-shop-lib.mjs";

const T = "flows-shop";
const out = {};
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-states2" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(150_000);
const log = watch(page);
const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 300));

// 1. product 404 over time (+ the global 404 for comparison)
for (const [k, u] of [["product404", "/deo/ne-postoji-demo-9999"], ["global404", "/ovo-ne-postoji"], ["cat404", "/delovi/ne-postoji-kategorija"]]) {
  const t0 = Date.now();
  const r = await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded" });
  const samples = [];
  for (const ms of [0, 1500, 5000]) {
    if (ms) await sleep(ms);
    samples.push({ at: Date.now() - t0, text: (await bodyText()).slice(0, 120), h1: await page.locator("h1").count() });
  }
  out[k] = { status: r?.status(), samples, title: await page.title() };
  await shot(page, `${T}/S2-${k}-390`);
}

// 2. over-stock add feedback (stock 1): add once, then again
await page.goto(`${BASE}/deo/${P.low1}`, { waitUntil: "domcontentloaded" });
await page.locator("#buy-box").waitFor();
await page.waitForFunction(() => Object.keys(document.querySelector('#buy-box [data-testid="product-add-to-cart"]') ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 120_000 });
const add = page.locator("#buy-box").getByTestId("product-add-to-cart");
await add.click();
await sleep(2500);
await add.click().catch(() => {});
await sleep(2500);
out.overStock = {
  buyBox: (await page.locator("#buy-box").innerText()).replace(/\s+/g, " ").slice(0, 300),
  live: await page.evaluate(() => [...document.querySelectorAll('[role="status"],[role="alert"],[aria-live]')].map((e) => e.innerText.trim()).filter(Boolean)),
  cartCount: await page.getByTestId("cart-count").first().textContent().catch(() => null),
};
await shot(page, `${T}/S2-over-stock-second-add-390`);

// 3. back in stock with consent
const email = `audit-flows-bis2-${Date.now()}@primer.rs`;
await page.goto(`${BASE}/deo/${P.zero0012}`, { waitUntil: "domcontentloaded" });
await page.locator("#buy-box").waitFor();
await sleep(5000);
const box = page.locator("#buy-box");
const submitBis = async (value) => {
  await box.locator("input[type=email]").first().fill(value);
  const cb = box.getByRole("checkbox").first();
  if ((await cb.count()) && (await cb.getAttribute("aria-checked")) !== "true" && !(await cb.isChecked().catch(() => false))) await cb.click();
  await box.getByRole("button", { name: /Obavesti me/ }).click();
  await sleep(3500);
  return (await box.innerText()).replace(/\s+/g, " ").slice(0, 400);
};
out.bisValid = await submitBis(email);
await shot(page, `${T}/S2-bis-valid-390`, { locator: box });
await page.reload({ waitUntil: "domcontentloaded" });
await box.waitFor();
await sleep(5000);
out.bisDuplicate = await submitBis(email.toUpperCase());
await shot(page, `${T}/S2-bis-duplicate-390`, { locator: box });
try {
  out.bisProbe = convexRun("testing:backInStockProbe", { email });
} catch (e) {
  out.bisProbe = String(e).slice(0, 200);
}

// 4. unsubscribe with a bad token: click the button
await page.goto(`${BASE}/obavestenja/odjava/nevazeci-token-123`, { waitUntil: "domcontentloaded" });
await sleep(4000);
await page.getByRole("button", { name: /Odjavi me/ }).click().catch((e) => (out.unsubClickErr = String(e).slice(0, 200)));
await sleep(4000);
out.unsubAfterClick = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400);
out.unsubRobots = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
await shot(page, `${T}/S2-unsubscribe-bad-clicked-390`);
out.log = log;
console.log(JSON.stringify(out, null, 1).slice(0, 8000));
saveJson("states2.json", out);
await browser.close();
