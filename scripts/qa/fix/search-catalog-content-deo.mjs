// VIS-07 / VIS-22 / COPY-07 / SEO-06 (unknown slug) re-verification on the product page.
// AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/search-catalog-content-deo.mjs
import fs from "node:fs";

import { BASE, launch, newContext, overflowX, revealCheck, scrollThrough, shot } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/search-catalog-content";
const SLUG = "kocioni-disk-prednji-276-24-mm-demo-0004";
const report = { base: BASE, widths: {} };

const browser = await launch();
try {
  for (const width of [390, 768, 1024, 1440]) {
    const ctx = await newContext(browser, { width, height: 900, mobile: width < 1024 });
    const page = await ctx.newPage();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/deo/${SLUG}`, { waitUntil: "networkidle" });
    const box = async (sel) =>
      page
        .locator(sel)
        .first()
        .boundingBox()
        .catch(() => null);
    const h1 = await box("h1");
    const drawing = await box("figure:has(figcaption:has-text('Mere diska'))");
    const gallery = await box("figure:has(figcaption:has-text('Ilustracija kategorije'))");
    report.widths[width] = {
      h1Top: h1 && Math.round(h1.y),
      drawingTop: drawing && Math.round(drawing.y),
      drawingVisible: drawing !== null && drawing.width > 0,
      drawingLeft: drawing && Math.round(drawing.x),
      galleryTop: gallery && Math.round(gallery.y),
      h1Left: h1 && Math.round(h1.x),
      caption: await page
        .locator("figcaption:has-text('Ilustracija kategorije')")
        .first()
        .evaluate((e) => ({ tag: e.tagName, size: getComputedStyle(e).fontSize, inside: e.parentElement?.tagName }))
        .catch(() => null),
      warranty: await page
        .locator("dt:has-text('Garancija') + dd")
        .first()
        .textContent()
        .catch(() => null),
      overflow: await overflowX(page),
    };
    if (width === 768 || width === 1440) {
      await shot(page, `../fix/search-catalog-content/deo-${width}`, { fullPage: true });
      await scrollThrough(page);
      report.widths[width].reveal = await revealCheck(page);
    }
    await ctx.close();
  }
  const res = await fetch(`${BASE}/deo/ne-postoji-${Date.now()}`, { redirect: "manual" });
  const html = await res.text();
  report.unknown = { status: res.status, hasH1: /<h1[\s>]/.test(html) };
} finally {
  await browser.close();
}
fs.writeFileSync(`${OUT}/deo.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
