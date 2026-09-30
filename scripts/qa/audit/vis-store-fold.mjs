/** vis-store: where does the first product card (and its price + button) land on phones? */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
import { ROUTES } from "./vis-store-routes.mjs";
const keys = ["cat", "catf", "landb", "landm", "sname", "soem", "hub"];
const sizes = [{ w: 360, h: 780 }, { w: 390, h: 844 }, { w: 768, h: 1024 }];
const browser = await launch();
const rows = [];
for (const s of sizes) {
  const ctx = await newContext(browser, { width: s.w, height: s.h, tag: `vis-store-fold-${s.w}` });
  const page = await ctx.newPage();
  for (const k of keys) {
    await page.goto(BASE + ROUTES[k], { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="product-card"], article');
      const r = card?.getBoundingClientRect();
      const price = card?.querySelector('[data-reveal="off"], [class*=numeral]');
      const btn = card?.querySelector("button");
      const lead = document.querySelector("main h1 + p, main header p");
      const h1 = document.querySelector("main h1")?.getBoundingClientRect();
      return {
        cardTop: r ? Math.round(r.top) : null,
        priceBottom: price ? Math.round(price.getBoundingClientRect().bottom) : null,
        buttonBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
        cardBottom: r ? Math.round(r.bottom) : null,
        h1Top: h1 ? Math.round(h1.top) : null,
        leadLines: lead ? Math.round(lead.getBoundingClientRect().height / parseFloat(getComputedStyle(lead).lineHeight)) : null,
        vh: innerHeight,
      };
    });
    rows.push({ route: ROUTES[k], width: s.w, ...m, priceAboveFold: m.priceBottom != null && m.priceBottom <= m.vh });
    console.log(s.w, k.padEnd(6), JSON.stringify(m));
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/vis-store/fold-metrics.json", JSON.stringify(rows, null, 1));
await browser.close();
