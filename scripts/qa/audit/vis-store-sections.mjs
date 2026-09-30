/**
 * vis-store: viewport captures at real scroll positions, one per <section>/<footer> (full-page captures
 * are unreliable with content-visibility:auto and the sticky hero track).
 * Usage: node scripts/qa/audit/vis-store-sections.mjs <routeKey> <widthTags comma> [selector]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, WIDTHS, AUDIT_DIR, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";
import { ROUTES } from "./vis-store-routes.mjs";

const [key, wTags = "390,1440", selector = "main section, main > div > section, footer"] = process.argv.slice(2);
const widths = WIDTHS.filter((w) => wTags.split(",").includes(w.tag));

const browser = await launch("chromium");
const out = {};
for (const w of widths) {
  const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `vis-store-sec-${key}-${w.tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(BASE + ROUTES[key], { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1200);
  await scrollThrough(page);
  const n = await page.locator(selector).count();
  const info = [];
  for (let i = 0; i < n; i++) {
    const loc = page.locator(selector).nth(i);
    const box = await loc.boundingBox().catch(() => null);
    if (!box || box.height < 40) continue;
    const y = await loc.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((yy) => window.scrollTo(0, Math.max(0, yy - 70)), y);
    await page.waitForTimeout(1300);
    const label = await loc.evaluate((el) => (el.getAttribute("aria-label") || el.querySelector("h1,h2,h3")?.textContent || el.tagName).trim().slice(0, 40));
    const file = await shot(page, `vis-store/${key}/sec-${w.tag}-${String(i).padStart(2, "0")}`);
    info.push({ i, label, y: Math.round(y), h: Math.round(box.height), file });
  }
  out[w.tag] = { info, log };
  console.log(w.tag, JSON.stringify(info.map((x) => `${x.i}:${x.label}@${x.y}/${x.h}`)));
  await ctx.close();
}
mkdirSync(path.join(AUDIT_DIR, "vis-store"), { recursive: true });
writeFileSync(path.join(AUDIT_DIR, "vis-store", `sections-${key}.json`), JSON.stringify(out, null, 1));
await browser.close();
