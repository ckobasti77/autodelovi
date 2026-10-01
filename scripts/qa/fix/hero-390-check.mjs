// Step 22: 390 px hero framing check. Scrolls the 3D stage into view, screenshots it and measures the car
// (non-background pixels) against the stage box: car height/width as % of the stage, empty band above.
import { launch, newContext } from "../audit/kit.mjs";
import sharp from "sharp";
const base = process.env.AUDIT_BASE ?? "http://localhost:3100";
const out = process.argv[2] ?? "docs/qa/fix/close/hero-390-poster.webp";
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 390, height: 844, deviceScaleFactor: 2, tag: "hero390" });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const img = page.locator("picture img").first();
  const stage = img.locator("xpath=ancestor::*[self::div or self::section][1]/..");
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const box = await stage.boundingBox();
  const buf = await stage.screenshot({ type: "png" });
  await sharp(buf).webp({ quality: 75 }).toFile(out);
  const { data, info: m } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const i = (y * m.width + x) * m.channels;
    const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    if (d > 70) { if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  const s = m.height / box.height;
  console.log(JSON.stringify({ stage: box, poster: await img.evaluate((e) => e.currentSrc), carHeightPct: +(((maxY - minY) / m.height) * 100).toFixed(1), carWidthPct: +(((maxX - minX) / m.width) * 100).toFixed(1), emptyAbovePx: +(minY / s).toFixed(0), emptyBelowPx: +((m.height - maxY) / s).toFixed(0), out }));
} finally { await browser.close(); }
