/**
 * vis-store: DPR-2 crops of category tiles on /delovi (1440) to judge render legibility, plus a
 * contact sheet of the weakest and strongest renders side by side.
 */
import sharp from "sharp";
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";

const names = ["Kočione pločice", "ABS senzori", "Brizgaljke i pumpa goriva", "Spone i stabilizatori", "Brisači", "Amortizeri i opruge", "Kočioni diskovi", "Menjač (DSG)"];
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, deviceScaleFactor: 2, tag: "vis-store-tiles" });
const page = await ctx.newPage();
await page.goto(`${BASE}/delovi`, { waitUntil: "load" });
await scrollThrough(page);
const bufs = [];
for (const n of names) {
  const link = page.locator("main a", { hasText: n }).first();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  bufs.push(await link.screenshot({ type: "png" }));
}
// contact sheet 4 x 2
const tiles = await Promise.all(bufs.map((b) => sharp(b).resize({ width: 480, height: 540, fit: "contain", background: "#0D0F11" }).png().toBuffer()));
const sheet = await sharp({ create: { width: 480 * 4, height: 540 * 2, channels: 3, background: "#0D0F11" } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % 4) * 480, top: Math.floor(i / 4) * 540 })))
  .webp({ quality: 72 })
  .toFile("docs/qa/audit/vis-store/delovi/tiles-contact-sheet-dpr2.webp");
console.log(sheet);
await browser.close();
