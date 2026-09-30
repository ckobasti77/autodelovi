// vis-store-04 chip vs render zoom: first card thumbnail at DPR 2 for several widths.
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, AUDIT_DIR } from "./kit.mjs";
import path from "node:path";

const browser = await launch("chromium");
const res = [];
try {
  for (const [w, h] of [[1024, 768], [1440, 900], [1920, 1080]]) {
    const ctx = await newContext(browser, { width: w, height: h, deviceScaleFactor: 2, tag: "vfy-vs04c" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const card = page.locator("ul.grid > li article").first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const info = await card.evaluate((a) => {
      const img = a.querySelector("img");
      const r = img.getBoundingClientRect();
      const chip = [...a.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^(OEM kvalitet|Original VAG|Aftermarket)$/.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0);
      const c = chip[0]?.closest("span,div")?.getBoundingClientRect();
      const box = img.parentElement.getBoundingClientRect();
      return { img: [r.x, r.y, r.width, r.height].map(Math.round), box: [box.x, box.y, box.width, box.height].map(Math.round), chip: c ? [c.x, c.y, c.width, c.height].map(Math.round) : null, fit: getComputedStyle(img).objectFit, pad: getComputedStyle(img).padding };
    });
    res.push({ w, ...info });
    const buf = await card.screenshot({ type: "png" });
    await sharp(buf).webp({ quality: 75 }).toFile(path.join(AUDIT_DIR, `verify/vis-store/vis-store-04-reproduce-card-${w}.webp`));
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-04-reproduce-chip.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
