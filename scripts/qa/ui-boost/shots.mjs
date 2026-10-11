/**
 * UI boost screenshots (steps 26–27, docs/design/UI-BOOST.md):
 *   node scripts/qa/ui-boost/shots.mjs <outDir> [--base=http://localhost:3000] [--only=home,cart] [--fold]
 *
 * Captures the page set of kit.mjs at 390 × 844 and 1440 × 900 after scrolling every page end
 * to end (so the reveals have run): storefront as a visitor, the mechanic portal and the
 * account as the shared audit accounts (.playwright/audit-accounts.json), the admin as the
 * seeded owner. Full-page WebP (quality 72) plus, with --fold, the first screen as its own
 * file. Prints the reveal contract per page (hidden / pending / leftover words), horizontal
 * overflow and console errors.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { forEachPage, launch, parseArgs, renderEverything, scrollThrough } from "./kit.mjs";

const args = parseArgs();
const outDir = path.resolve(args.positional[0] ?? "docs/qa/screens/step-26");
const fold = args.has("fold");
mkdirSync(outDir, { recursive: true });

async function contract(page) {
  return page.evaluate(() => ({
    hidden: [...document.querySelectorAll("*")].filter(
      (e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0",
    ).length,
    pending: document.querySelectorAll('[data-reveal-state="pending"]').length,
    words: document.querySelectorAll(".reveal-word").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

async function save(page, file, fullPage) {
  let buf;
  if (fullPage) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const w = page.viewportSize().width;
    buf = await page.screenshot({
      type: "png",
      fullPage: true,
      ...(h > 15000 ? { clip: { x: 0, y: 0, width: w, height: 15000 } } : {}),
    });
  } else {
    buf = await page.screenshot({ type: "png" });
  }
  await sharp(buf).webp({ quality: 72 }).toFile(file);
}

const browser = await launch();
const errors = new Map();
await forEachPage(browser, args, async (page, name, _spec, viewport) => {
  if (!errors.has(page)) {
    const list = [];
    errors.set(page, list);
    page.on("console", (m) => m.type() === "error" && list.push(m.text().slice(0, 200)));
    page.on("pageerror", (e) => list.push(`pageerror: ${String(e).slice(0, 200)}`));
  }
  const list = errors.get(page);
  if (fold) await save(page, path.join(outDir, `${name}-${viewport.tag}-fold.webp`), false);
  await scrollThrough(page);
  const c = await contract(page);
  await renderEverything(page);
  await save(page, path.join(outDir, `${name}-${viewport.tag}.webp`), true);
  console.log(
    `${name}@${viewport.tag}: hidden=${c.hidden} pending=${c.pending} words=${c.words} overflowX=${c.overflow} errors=${list.length}${list.length ? ` → ${list.slice(0, 2).join(" | ")}` : ""}`,
  );
  list.length = 0;
});
await browser.close();
