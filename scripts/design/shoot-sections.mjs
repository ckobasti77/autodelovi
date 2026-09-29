// Screenshot each section of a long page (e.g. /styleguide) at the given viewports.
// Usage: node scripts/design/shoot-sections.mjs <url> <outDir> <id,id,...> [--vp 1440x900,390x844] [--wait 1400]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [url, outDir, idList, ...rest] = process.argv.slice(2);
if (!url || !outDir || !idList) {
  console.error("usage: node scripts/design/shoot-sections.mjs <url> <outDir> <id,id,...> [--vp WxH,...] [--wait ms]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(name);
  return i === -1 ? fallback : rest[i + 1];
};
const viewports = opt("--vp", "1440x900,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const wait = Number(opt("--wait", "1400"));
const ids = idList.split(",");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
for (const [width, height] of viewports) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${width}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${width}] pageerror ${e.message}`));
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(wait);
  for (const id of ids) {
    const found = await page.evaluate((target) => {
      const el = document.getElementById(target);
      if (!el) return false;
      el.scrollIntoView({ block: "start" });
      return true;
    }, id);
    if (!found) {
      console.log("missing section", id);
      continue;
    }
    await page.waitForTimeout(wait);
    const file = `${outDir}/${id}-${width}.png`;
    await page.screenshot({ path: file });
    console.log("wrote", file);
  }
  await context.close();
}
await browser.close();
console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "console: no errors");
