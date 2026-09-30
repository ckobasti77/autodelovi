// perf-bundle track: which next/image candidate a 390 px phone at DPR 3 downloads for product-card
// thumbnails vs the rendered width (sizes correctness), on category, search and the ads landing.
//   node scripts/qa/audit/perf-bundle-dpr.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, deviceScaleFactor: 3, tag: "perf-bundle-dpr" });
const page = await ctx.newPage();
const out = {};
for (const [name, route] of [["category", "/delovi/kocioni-diskovi"], ["search", "/pretraga?q=disk"], ["landing", "/ponuda/kocione-plocice-golf"]]) {
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(1200);
  out[name] = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="product-card"] img')].slice(0, 6).map((img) => ({
      currentSrc: img.currentSrc.replace(location.origin, ""),
      renderedCssPx: Math.round(img.getBoundingClientRect().width),
      neededPx: Math.round(img.getBoundingClientRect().width * devicePixelRatio),
      sizes: img.sizes,
    })),
  );
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes("/_next/image"))
      .map((e) => `${e.transferSize} ${e.name.replace(location.origin, "")}`),
  );
  out[`${name}-resources`] = bytes;
  console.log(`== ${name}`);
  for (const r of out[name]) console.log(`   rendered ${r.renderedCssPx} css px (needs ${r.neededPx} px) -> ${r.currentSrc}`);
  for (const b of bytes) console.log(`   fetched ${b}`);
  if (name === "category") await shot(page, "perf-bundle/category-390-dpr3-cards", {});
}
await browser.close();
writeFileSync("docs/qa/audit/perf-bundle/dpr3-sizes.json", JSON.stringify(out, null, 2));
