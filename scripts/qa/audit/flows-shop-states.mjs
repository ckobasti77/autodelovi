/**
 * flows-shop: cart and page states — empty cart, 404 product, quantity vs stock, stock states of
 * zero-stock products, back-in-stock subscribe (invalid, valid, duplicate) and the unsubscribe
 * page with a bad token. 390 px guest. Evidence: docs/qa/audit/flows-shop/S-*.webp + states.json.
 */
import { BASE, convexRun, launch, newContext, shot, watch } from "./kit.mjs";
import { P, addToCart, cartLines, saveJson, sleep } from "./flows-shop-lib.mjs";

const T = "flows-shop";
const out = {};
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-states" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(150_000);
const log = watch(page);
const text = async (sel = "main") => (await page.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 600);

// 1. empty cart + empty checkout
out.emptyCart = await cartLines(page);
out.emptyCartText = await text();
await shot(page, `${T}/S-empty-cart-390`);
await page.goto(`${BASE}/porudzbina`, { waitUntil: "domcontentloaded" });
await sleep(2500);
out.emptyCheckoutText = await text();
await shot(page, `${T}/S-empty-checkout-390`);

// 2. 404 product
const r404 = await page.goto(`${BASE}/deo/ne-postoji-demo-9999`, { waitUntil: "domcontentloaded" });
out.product404 = { status: r404?.status(), text: await text("body"), robots: await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null) };
await shot(page, `${T}/S-product-404-390`);

// 3. zero-stock products: badge + CTA
out.zero = {};
for (const k of ["zero0001", "zero0012", "zero0026", "zero0008"]) {
  await page.goto(`${BASE}/deo/${P[k]}`, { waitUntil: "domcontentloaded" });
  await page.locator("#buy-box").waitFor({ timeout: 30_000 }).catch(() => {});
  await sleep(800);
  out.zero[k] = await text("#buy-box");
}

// 4. quantity vs stock: low1 has stock 1 — try 5 on the product page, then add twice
await page.goto(`${BASE}/deo/${P.low1}`, { waitUntil: "domcontentloaded" });
await page.locator("#buy-box").waitFor();
await page.waitForFunction(() => {
  const b = document.querySelector('#buy-box [data-testid="product-add-to-cart"]');
  return b && Object.keys(b).some((k) => k.startsWith("__react"));
});
const qty = page.locator("#buy-box").getByRole("spinbutton");
out.low1 = { buyBox: await text("#buy-box"), max: await qty.getAttribute("max").catch(() => null) };
await qty.fill("5").catch(() => {});
await qty.blur().catch(() => {});
await sleep(400);
out.low1.valueAfter5 = await qty.inputValue().catch(() => null);
await page.locator("#buy-box").getByTestId("product-add-to-cart").click();
await sleep(1500);
out.low1.afterAdd = await text("#buy-box");
await shot(page, `${T}/S-qty-over-stock-390`);
await addToCart(page, P.low1, 1).catch((e) => (out.low1.secondAddErr = String(e).slice(0, 200)));
out.low1.cart = await cartLines(page);
out.low1.cartText = await text();
await shot(page, `${T}/S-cart-over-stock-390`, { fullPage: true });
// increment on the cart page
const inc = page.getByRole("button", { name: /Povećaj|Više|\+/ }).first();
out.low1.incDisabled = await inc.isDisabled().catch(() => null);

// 5. back in stock: invalid, valid, duplicate
const bisEmail = `audit-flows-bis-${Date.now()}@primer.rs`;
await page.goto(`${BASE}/deo/${P.zero0012}`, { waitUntil: "domcontentloaded" });
await page.locator("#buy-box").waitFor();
await page.waitForFunction(() => Object.keys(document.querySelector("#buy-box button") ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 60_000 }).catch(() => {});
const bisInput = page.locator("#buy-box input[type=email], #buy-box input[name=email]").first();
out.bis = { present: await bisInput.count() };
if (out.bis.present) {
  await bisInput.fill("marko@primer");
  await page.locator("#buy-box").getByRole("button", { name: /Javi|Obavesti|Prijavi/ }).first().click();
  await sleep(1200);
  out.bis.invalid = await text("#buy-box");
  await shot(page, `${T}/S-bis-invalid-390`, { locator: page.locator("#buy-box") });
  await bisInput.fill(bisEmail);
  await page.locator("#buy-box").getByRole("button", { name: /Javi|Obavesti|Prijavi/ }).first().click();
  await page.getByTestId("back-in-stock-done").waitFor({ timeout: 20_000 }).catch(() => {});
  out.bis.valid = await text("#buy-box");
  // duplicate in a fresh page
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#buy-box").waitFor();
  await sleep(4000);
  const again = page.locator("#buy-box input[type=email], #buy-box input[name=email]").first();
  if (await again.count()) {
    await again.fill(bisEmail.toUpperCase());
    await page.locator("#buy-box").getByRole("button", { name: /Javi|Obavesti|Prijavi/ }).first().click();
    await sleep(2500);
    out.bis.duplicate = await text("#buy-box");
    await shot(page, `${T}/S-bis-duplicate-390`, { locator: page.locator("#buy-box") });
  }
  try {
    out.bis.probe = convexRun("testing:backInStockProbe", { email: bisEmail });
  } catch (e) {
    out.bis.probe = String(e).slice(0, 200);
  }
}

// 6. unsubscribe with bad token
const ru = await page.goto(`${BASE}/obavestenja/odjava/nevazeci-token-123`, { waitUntil: "domcontentloaded" });
await sleep(2500);
out.unsubscribeBad = { status: ru?.status(), text: await text() };
await shot(page, `${T}/S-unsubscribe-bad-390`);

// 7. bad order / inquiry tokens
for (const [k, u] of [
  ["orderBad", "/porudzbina/nevazeci-token"],
  ["thanksBad", "/porudzbina/hvala/nevazeci-token"],
  ["proformaBad", "/porudzbina/nevazeci-token/predracun"],
  ["inquiryBad", "/upit/nevazeci-token"],
]) {
  const r = await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  out[k] = { status: r?.status(), h1: await page.locator("h1").first().innerText().catch(() => ""), text: (await text()).slice(0, 300) };
}
out.log = log;
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
saveJson("states.json", out);
await browser.close();
