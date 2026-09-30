/** flows-shop-03 follow-up: Golf VII-filtered category count vs search results, fit badges on the filtered listing. */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const OUT = "verify/flows-shop";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-fs03b" });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(150_000);
const res = {};
for (const [k, u] of [
  ["catGolf7", "/delovi/kocioni-diskovi?marka=volkswagen&model=golf&generacija=golf-7"],
  ["catPadsGolf7", "/delovi/kocione-plocice?marka=volkswagen&model=golf&generacija=golf-7"],
]) {
  await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor();
  await sleep(3500);
  res[k] = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    return {
      url: location.pathname + location.search,
      h1: document.querySelector("h1")?.textContent?.trim(),
      cards: cards.length,
      cardNames: cards.map((c) => (c.querySelector("h2,h3,a")?.textContent ?? "").trim().slice(0, 70)),
      fitBadges: cards.map((c) => (c.innerText.match(/Odgovara za[^\n]*|Univerzalni deo/) ?? [""])[0]),
    };
  });
  if (k === "catGolf7") {
    await page.evaluate(() => document.querySelector('[data-testid="product-card"]')?.scrollIntoView({ block: "start" }));
    await sleep(1200);
    await shot(page, `${OUT}/flows-shop-03-reproduce-390-category-golf7-fit`);
  }
}
console.log(JSON.stringify(res, null, 1));
writeFileSync(`docs/qa/audit/${OUT}/flows-shop-03-reproduce-b.json`, JSON.stringify(res, null, 1));
await browser.close();
