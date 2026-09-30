// Skeptic verification of flows-shop-02 (search relevance for "<part> golf 7").
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const queries = ["pločice golf 7", "pločice golf vii", "golf 7 pločice", "kočioni disk golf 7", "amortizer golf 7"];
const browser = await launch("chromium");
const out = [];
for (const q of queries) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-fs02" });
  const page = await ctx.newPage();
  const log = watch(page);
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    try {
      await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle", timeout: 60000 });
      ok = true;
    } catch (e) { if (attempt) throw e; }
  }
  await page.waitForTimeout(1500);
  const cards = await page.evaluate(() => {
    const links = [...document.querySelectorAll('main a[href^="/deo/"]')];
    const seen = new Set();
    const names = [];
    for (const a of links) {
      const h = a.getAttribute("href");
      if (seen.has(h)) continue;
      seen.add(h);
      names.push((a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80));
    }
    return names;
  });
  const chips = await page.$$eval('nav[aria-label="Kategorije"] a', (els) => els.map((e) => e.textContent.trim()));
  const h1 = await page.$eval("h1", (e) => e.textContent.trim()).catch(() => "");
  const firstPadIdx = cards.findIndex((n) => /plo[cč]ic|disk|amortizer/i.test(n));
  const slug = q.replace(/[^a-z0-9]+/gi, "-");
  // Scroll to the results heading and shoot the first screen of cards.
  await page.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((x) => /Proizvodi/.test(x.textContent)); h?.scrollIntoView({ block: "start" }); });
  await page.waitForTimeout(1200);
  const file = await shot(page, `verify/flows-shop/flows-shop-02-skeptic-${slug}-390`);
  out.push({ q, h1, chips, count: cards.length, firstNamedPartPosition: firstPadIdx + 1, first8: cards.slice(0, 8), file, errors: log });
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-02-skeptic.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.map(({ errors, ...r }) => r), null, 2));
