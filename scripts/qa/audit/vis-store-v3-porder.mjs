/** vis-store: product page reading order per width (gallery, spec drawing, H1, price, buy button). */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
const out = {};
for (const [w, h] of [[360, 780], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vis-store-po-${w}-${Date.now()}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const top = (e) => (e ? Math.round(e.getBoundingClientRect().top + scrollY) : null);
    const drawing = [...document.querySelectorAll("main svg")].find((s) => /Ø/.test(s.textContent));
    const btn = [...document.querySelectorAll("#buy-box button")].find((b) => /korpu|Poruči/.test(b.textContent));
    return { vh: innerHeight, galleryTop: top(document.querySelector("main img")), drawingTop: top(drawing), h1Top: top(document.querySelector("main h1")), buyBoxTop: top(document.getElementById("buy-box")), buyButtonTop: top(btn), buyButtonBottom: btn ? Math.round(btn.getBoundingClientRect().bottom + scrollY) : null };
  });
  r.buyButtonAboveFold = r.buyButtonBottom !== null && r.buyButtonBottom <= r.vh;
  r.h1AboveFold = r.h1Top < r.vh;
  out[w] = r;
  console.log(w, JSON.stringify(r));
  if (w === 768) await shot(page, "vis-store/v3/product-768-fold");
  await ctx.close();
}
writeFileSync("docs/qa/audit/vis-store/v3-product-order.json", JSON.stringify(out, null, 1));
await browser.close();
