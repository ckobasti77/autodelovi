// Verifier: copy-15 — hero counts 42 vs 44 on /
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const out = {};
const browser = await launch("chromium");
for (const width of [390, 768, 1440]) {
  const height = width === 390 ? 844 : width === 768 ? 1024 : 900;
  const ctx = await newContext(browser, { width, height, tag: `vc15-${width}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const grab = () =>
    page.evaluate(() => {
      const vis = (e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      const hits = [...document.querySelectorAll("p, dt, dd, a, span, h2, div")]
        .filter((e) => e.children.length < 6 && /kategorij/i.test(e.textContent || "") && (e.textContent || "").length < 120)
        .filter(vis)
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          text: (e.innerText || e.textContent).replace(/\s+/g, " ").trim(),
          top: Math.round(e.getBoundingClientRect().top + scrollY),
        }));
      const seen = new Set();
      return hits.filter((h) => (seen.has(h.text) ? false : (seen.add(h.text), true)));
    });
  out[`w${width}_load`] = await grab();
  await shot(page, `verify/copy/copy-15-reproduce-hero-${width}`);
  // scroll through the whole page, then collect again
  await scrollThrough(page);
  out[`w${width}_after_scroll`] = await grab();
  // go to category section with "Svih .. kategorija"
  const svih = page.getByText(/Svih \d+ kategorija/).first();
  if (await svih.count()) {
    await svih.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const box = await svih.boundingBox();
    await shot(page, `verify/copy/copy-15-reproduce-svih-${width}`);
    out[`w${width}_svih`] = await svih.innerText();
  }
  // at desktop: scroll into the hero until stage caption for a later stage appears
  if (width >= 1024) {
    for (const frac of [0.25, 0.5, 0.97]) {
      await page.evaluate((f) => {
        const hero = document.querySelector("section");
        const h = hero ? hero.scrollHeight : 4000;
        window.scrollTo(0, h * f);
      }, frac);
      await page.waitForTimeout(1800);
      out[`w${width}_hero_${frac}`] = await grab();
      await shot(page, `verify/copy/copy-15-reproduce-hero-${width}-p${Math.round(frac * 100)}`);
    }
  }
  out[`w${width}_log`] = log;
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/copy/copy-15-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
