/** verify vis-store-02 (skeptic): real-page captures of the category renders at 1440 (DPR 1 and 2) and 390. */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";

const out = {};
const browser = await launch("chromium");
async function go(tag, url, opts, fn) {
  const ctx = await newContext(browser, opts);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.goto(BASE + url, { waitUntil: "load", timeout: 60000 }));
  await page.waitForTimeout(1200);
  await fn(page, tag);
  await ctx.close();
}
// Hub at 1440 DPR 2 — tile row only
await go("hub-1440-dpr2", "/delovi/kocnice", { width: 1440, height: 900, deviceScaleFactor: 2 }, async (page, tag) => {
  await scrollThrough(page); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(800);
  const grid = page.locator("main a[href^='/delovi/']").first();
  const box = await grid.boundingBox();
  await shot(page, `verify/vis-store/vis-store-02-skeptic-${tag}`, { clip: { x: 40, y: box.y - 10, width: 1360, height: 330 } });
});
// Home categories at 1440
await go("home-1440", "/", { width: 1440, height: 900 }, async (page, tag) => {
  await scrollThrough(page);
  const h = page.getByRole("heading", { name: /Najtraženije kategorije/i }).first();
  await h.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, -80)); await page.waitForTimeout(1500);
  await shot(page, `verify/vis-store/vis-store-02-skeptic-${tag}`);
  const imgs = await page.$$eval("img[src*='images%2Fparts'], img[src*='/images/parts/']", (els) => els.slice(0, 12).map((e) => ({ src: decodeURIComponent(e.currentSrc).split("url=")[1]?.split("&")[0] ?? e.currentSrc, w: e.clientWidth, h: e.clientHeight })));
  out[tag] = imgs;
});
// Home categories at 390
await go("home-390", "/", { width: 390, height: 844, deviceScaleFactor: 2 }, async (page, tag) => {
  await scrollThrough(page);
  const h = page.getByRole("heading", { name: /Najtraženije kategorije/i }).first();
  await h.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, -70)); await page.waitForTimeout(1500);
  await shot(page, `verify/vis-store/vis-store-02-skeptic-${tag}`);
});
// Product page pads, 1440 DPR 1 and 2: measure painted size of the main image
for (const dpr of [1, 2]) {
  await go(`pdp-pads-1440-dpr${dpr}`, "/deo/kocione-plocice-prednje-demo-0012", { width: 1440, height: 900, deviceScaleFactor: dpr }, async (page, tag) => {
    await page.waitForTimeout(800);
    await shot(page, `verify/vis-store/vis-store-02-skeptic-${tag}`);
    out[tag] = await page.$$eval("main img", (els) => els.slice(0, 3).map((e) => {
      const cs = getComputedStyle(e);
      const bw = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const bh = e.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const s = Math.min(bw / e.naturalWidth, bh / e.naturalHeight);
      return { src: e.currentSrc.slice(-80), natural: `${e.naturalWidth}x${e.naturalHeight}`, box: `${e.clientWidth}x${e.clientHeight}`, contentBox: `${Math.round(bw)}x${Math.round(bh)}`, paintedCss: `${Math.round(e.naturalWidth * s)}x${Math.round(e.naturalHeight * s)}`, dpr: devicePixelRatio, paintedDevicePx: Math.round(e.naturalWidth * s * devicePixelRatio) };
    }));
  });
}
// Ads landing: brake pads
await go("ponuda-390", "/ponuda/kocione-plocice-golf", { width: 390, height: 844, deviceScaleFactor: 2 }, async (page, tag) => {
  await scrollThrough(page);
  const img = page.locator("main img[src*='parts']").first();
  if (await img.count()) { await img.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, -200)); await page.waitForTimeout(1200); }
  await shot(page, `verify/vis-store/vis-store-02-skeptic-${tag}`);
});
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-02-skeptic-capture.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
