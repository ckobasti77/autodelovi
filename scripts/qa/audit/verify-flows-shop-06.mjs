// Verifier (flows-shop-06): long unbroken search query and horizontal overflow; plus 04 end-of-list shot.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, overflowX } from "./kit.mjs";
const out = {};
const q40 = "5Q0615505R".repeat(4);
const q120 = "5Q0615505R".repeat(12);
const q24 = "5Q0615505R5Q0615505R5Q06"; // 24 chars
const qText = "amortizerzaprednjiostakovanitrap"; // 32-char text token
const cases = [
  ["chromium", 360, q40], ["chromium", 390, q40], ["chromium", 390, q120], ["chromium", 390, q24],
  ["chromium", 390, qText], ["chromium", 768, q120], ["chromium", 1440, q120], ["webkit", 390, q40],
];
for (const engine of ["chromium", "webkit"]) {
  const browser = await launch(engine);
  for (const [eng, width, q] of cases.filter((c) => c[0] === engine)) {
    const ctx = await newContext(browser, { width, height: 800, tag: `v06-${width}`, engine });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const ov = await overflowX(page);
    const detail = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const pick = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { sel, left: Math.round(r.left), right: Math.round(r.right), text: e.textContent.trim().slice(0, 50) }; });
      return { vw, scrollW: document.documentElement.scrollWidth, h1: pick("main h1"), h2: pick("main h2"), p: pick("main h2 ~ p, main h2 + *").slice(0, 3), bodyOverflowX: getComputedStyle(document.body).overflowX, htmlOverflowX: getComputedStyle(document.documentElement).overflowX };
    });
    const key = `${eng} ${width} len${q.length}`;
    out[key] = { ...ov, ...detail };
    if ((width === 390 || width === 360) && q === q40) out[key].shot = await shot(page, `verify/flows-shop/flows-shop-06-reproduce-${eng}-${width}-len40`);
    if (width === 390 && q === q24) out[key].shot = await shot(page, `verify/flows-shop/flows-shop-06-reproduce-${eng}-${width}-len24`);
    if (width === 1440) out[key].shot = await shot(page, `verify/flows-shop/flows-shop-06-reproduce-${eng}-${width}-len120`);
    // Can the user actually scroll sideways?
    out[key].scrollXAfter = await page.evaluate(() => { window.scrollTo(500, window.scrollY); return window.scrollX; });
    if ((width === 390) && q === q40) out[key].shotScrolled = await shot(page, `verify/flows-shop/flows-shop-06-reproduce-${eng}-${width}-len40-scrolled`);
    await ctx.close();
  }
  if (engine === "chromium") {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "v04-end" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("golf 7")}`, { waitUntil: "networkidle" });
    const last = page.locator('section[aria-labelledby^="g-"] article').last();
    await last.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 250));
    await page.waitForTimeout(1500);
    out["04-end"] = await shot(page, "verify/flows-shop/flows-shop-04-reproduce-listend-390");
    await ctx.close();
  }
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-06-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
