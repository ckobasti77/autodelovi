/**
 * Independent verification of copy-14 („Original VAG · Original VAG“ on cards and descriptions).
 *   node scripts/qa/audit/verify-copy-14.mjs
 * Output: docs/qa/audit/verify/copy/copy-14-reproduce.json + screenshots.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot, scrollThrough } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const b = await launch();
const res = { cards: {}, descriptions: {} };
const routes = [
  "/delovi/kocioni-diskovi",
  "/pretraga?q=disk",
  "/ponuda/kocione-plocice-golf",
  "/vozila/volkswagen/golf/golf-7",
  "/delovi/kocioni-diskovi/volkswagen/golf",
];
for (const width of [390, 1440]) {
  const ctx = await newContext(b, { width, height: width < 800 ? 844 : 900, tag: `verify-copy14-${width}` });
  const page = await ctx.newPage();
  for (const r of routes) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
    await scrollThrough(page, { stepMs: 80 });
    const found = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("a[data-card-link]")].map((a) => a.closest("article, li, div.group") ?? a.parentElement);
      return cards
        .map((c) => {
          const vis = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== "none";
          const texts = [...c.querySelectorAll("p, span")]
            .filter((e) => vis(e) && e.children.length <= 2)
            .map((e) => e.innerText.trim())
            .filter((t) => /Original VAG/.test(t));
          return { name: c.querySelector("a[data-card-link]")?.innerText.trim(), originalVagVisible: texts };
        })
        .filter((c) => c.originalVagVisible.length);
    });
    res.cards[`${width} ${r}`] = found;
  }
  // Screenshot the first card with the dup on the category page
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
  await scrollThrough(page, { stepMs: 80 });
  const card = page.locator("a[data-card-link]", { hasText: "340" }).first();
  if (await card.count()) {
    const box = card.locator("xpath=ancestor::*[self::article or self::li][1]");
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await shot(page, `verify/copy/copy-14-reproduce-card-${width}`, { locator: box });
  }
  await ctx.close();
}
// Meta descriptions of genuine parts
for (const slug of ["kocioni-disk-prednji-340-30-mm-gti-demo-0005"]) {
  const html = await (await fetch(`${BASE}/deo/${slug}`)).text();
  res.descriptions[slug] = {
    description: html.match(/<meta name="description" content="([^"]*)"/)?.[1],
    ogDescription: html.match(/<meta property="og:description" content="([^"]*)"/)?.[1],
    visibleManufacturer: (html.replace(/<!-- -->/g, "").match(/Original VAG[^<]{0,40}/g) ?? []).slice(0, 6),
  };
}
writeFileSync(`${OUT}/copy-14-reproduce.json`, JSON.stringify(res, null, 2));
await b.close();
console.log("done");
