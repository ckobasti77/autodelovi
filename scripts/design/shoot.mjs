// Design screenshot helper (step 03+). Usage:
//   node scripts/design/shoot.mjs <url> <outPrefix> [--vp 1440x900,390x844] [--full] [--wait 800] [--reduced]
// Writes <outPrefix>-<w>.png for each viewport. Uses @playwright/test's bundled chromium.
import { chromium } from "@playwright/test";

const [url, outPrefix, ...rest] = process.argv.slice(2);
if (!url || !outPrefix) {
  console.error("usage: node scripts/design/shoot.mjs <url> <outPrefix> [--vp WxH,...] [--full] [--wait ms] [--reduced]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(name);
  return i === -1 ? fallback : rest[i + 1];
};
const viewports = opt("--vp", "1440x900,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const full = rest.includes("--full");
const wait = Number(opt("--wait", "900"));
const reduced = rest.includes("--reduced");

const browser = await chromium.launch();
const consoleErrors = [];
for (const [width, height] of viewports) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${width}] ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${width}] pageerror ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(wait);
  const file = `${outPrefix}-${width}.png`;
  await page.screenshot({ path: file, fullPage: full });
  console.log("wrote", file);
  await context.close();
}
await browser.close();
if (consoleErrors.length) {
  console.log("CONSOLE ERRORS:\n" + consoleErrors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("console: no errors");
}
