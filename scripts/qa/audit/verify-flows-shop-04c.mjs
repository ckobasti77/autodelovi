// Verifier (flows-shop-04): count product cards (grid items) in the result group.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
const browser = await launch("chromium");
const out = {};
for (const q of ["golf 7", "a", "golf", "amortizer golf"]) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v04c" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
  out[q] = await page.evaluate(() => {
    const sec = document.querySelector('section[aria-labelledby^="g-"]');
    const grid = sec.querySelector("ul, ol, [role=list]") ?? sec.querySelector("div.mt-5 > *");
    const items = grid ? grid.children.length : -1;
    const articles = sec.querySelectorAll("article").length;
    const meta = document.querySelector("h1").parentElement.querySelector("p").textContent.trim();
    const sampleHrefs = [...sec.querySelectorAll('a[href^="/deo/"]')].slice(0, 6).map((a) => a.getAttribute("href"));
    return { meta, gridTag: grid?.tagName, gridItems: items, articles, sampleHrefs };
  });
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-04-reproduce-cards.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
