/** flows-shop: repeat selected search queries in a browser to separate deterministic failures from network blips. */
import { BASE, launch, newContext, watch } from "./kit.mjs";
import { saveJson } from "./flows-shop-lib.mjs";
const qs = (process.argv[2] ?? "5Q0615,1K0615,5Q06,5Q061550").split(",");
const n = Number(process.argv[3] ?? 3);
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-search-repro" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(120_000);
const log = watch(page);
const out = [];
for (let i = 0; i < n; i++) {
  for (const q of qs) {
    await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(600);
    const h1 = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ");
    const cards = await page.getByTestId("product-card").count();
    out.push({ i, q, h1, cards });
    console.log(i, q, h1, cards);
  }
}
saveJson(`search-repro-${Date.now()}`, { out, log });
await browser.close();
